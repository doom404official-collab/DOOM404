import test from "node:test";
import assert from "node:assert/strict";
import {loadSelectedHolderEvidenceJob} from "../lib/selectedHolderEvidenceJob.mjs";
import {processEvidenceBatch} from "../lib/holderEvidenceBatch.mjs";
import {createHolderEvidenceStore} from "../lib/holderEvidenceStore.mjs";
const selected={id:"selected-job",mint:"mint-a"};
const checkpoint={version:1,mint:"mint-a",holders:[{ownerWallet:"a"},{ownerWallet:"b"}],wallets:{a:{},b:{}},edges:{ab:{signatures:["selected-signature"]}}};
function row(overrides={}){return {id:selected.id,mint:selected.mint,status:"partial",checkpoint:structuredClone(checkpoint),...overrides};}
function store(value){return {getById:async id=>{assert.equal(id,selected.id);return value;},getLatest:()=>{throw Error("Must not substitute latest checkpoint");}};}
test("selected historical job is used even when a newer or more recently updated job shares its mint",async()=>{
 const value=row();
 const calls=[];
 const jobStore={...store(value),getLatest:()=>row({id:"newer-job",checkpoint:{...checkpoint,edges:{}}})};
 const job=await loadSelectedHolderEvidenceJob({selected,jobStore});
 const result=await processEvidenceBatch({jobId:job.id,checkpoint:job.checkpoint,
  store:{seed:async id=>{calls.push(["seed",id]);return 1;},claim:async id=>{calls.push(["claim",id]);return [{signature:"selected-signature",attempts:0}];},
   finish:async(id,signature)=>{calls.push(["finish",id,signature]);return true;}},
  rpc:async(_method,[signature])=>{assert.equal(signature,"selected-signature");return null;}});
 assert.equal(result.processed,1);
 assert.equal(result.queuedSignatures,1);
 assert.deepEqual(calls,[["seed",selected.id],["claim",selected.id],["finish",selected.id,"selected-signature"]]);
});
for(const status of ["queued","running","partial","complete"]){
 test(`eligible ${status} job keeps its exact checkpoint`,async()=>{
  const value=row({status});
  assert.equal(await loadSelectedHolderEvidenceJob({selected,jobStore:store(value)}),value);
 });
}
for(const status of ["failed","superseded","cancelled",undefined]){
 test(`obsolete or ineligible ${status} job fails closed without replacement`,async()=>{
  await assert.rejects(loadSelectedHolderEvidenceJob({selected,jobStore:store(row({status}))}),{message:"EVIDENCE_JOB_NOT_ELIGIBLE"});
 });
}
test("deleted selected job is not replaced by another job",async()=>{
 await assert.rejects(loadSelectedHolderEvidenceJob({selected,jobStore:store(null)}),{message:"EVIDENCE_JOB_NOT_FOUND"});
});
for(const change of [{id:"other"},{mint:"other"}]){
 test(`mismatched row ${Object.keys(change)[0]} is rejected`,async()=>{
  await assert.rejects(loadSelectedHolderEvidenceJob({selected,jobStore:store(row(change))}),{message:"EVIDENCE_JOB_IDENTITY_MISMATCH"});
 });
}
for(const invalid of [null,{}, {...checkpoint,mint:"other"},{...checkpoint,version:2},{...checkpoint,holders:[]},{...checkpoint,edges:null},{...checkpoint,edges:[]},
 {...checkpoint,edges:{x:{}}},{...checkpoint,edges:{x:{signatures:[""]}}},
 {...checkpoint,holders:Array(21).fill({ownerWallet:"a"})},{...checkpoint,wallets:{a:{}}},
 {...checkpoint,wallets:{a:{},b:{},foreign:{}}},{...checkpoint,wallets:[]},{...checkpoint,holders:[{}]}]){
 test(`invalid checkpoint ${JSON.stringify(invalid)} fails closed`,async()=>{
  await assert.rejects(loadSelectedHolderEvidenceJob({selected,jobStore:store(row({checkpoint:invalid}))}),{message:"EVIDENCE_CHECKPOINT_INVALID"});
 });
}
test("malformed selection fails before any store call",async()=>{
 for(const selection of [null,{}, {id:"",mint:"m"},{id:"j",mint:" "}]){
  await assert.rejects(loadSelectedHolderEvidenceJob({selected:selection,jobStore:{getById:()=>assert.fail("Unexpected read")}}),{message:"EVIDENCE_SELECTION_INVALID"});
 }
});
test("lookup failure propagates without a fallback read",async()=>{
 await assert.rejects(loadSelectedHolderEvidenceJob({selected,jobStore:{getById:async()=>{throw Error("HOLDER_STORE_HTTP_503");}}}),{message:"HOLDER_STORE_HTTP_503"});
});
for(const dates of [["2026-10-15T10:00:00Z","2026-10-15T11:00:00Z"],["2026-10-15T11:00:00Z","2026-10-15T10:00:00Z"]]){
 test(`two snapshots of one mint stay keyed by ID with update order ${dates.join(" / ")}`,async()=>{
  const original=row({updated_at:dates[0]});
  const newer=row({id:"other-snapshot",updated_at:dates[1],checkpoint:{...checkpoint,edges:{}}});
  const rows=[original,newer].sort((a,b)=>b.updated_at.localeCompare(a.updated_at));
  const jobStore={getById:async id=>rows.find(row=>row.id===id),getLatest:async()=>rows[0]};
  const resolved=await loadSelectedHolderEvidenceJob({selected,jobStore});
  assert.equal(resolved,original);
  assert.deepEqual(resolved.checkpoint.edges,checkpoint.edges);
 });
}
test("only a genuinely empty selector response yields idle, never malformed identity",async()=>{
 let payload=[];
 const evidenceStore=createHolderEvidenceStore({url:"https://example.supabase.co",key:"test-secret",
  fetchImpl:async()=>({ok:true,status:200,json:async()=>payload})});
 assert.equal(await evidenceStore.nextJob(),null);
 for(const invalid of [null,{},[null],[{}],[selected,selected],[{id:"",mint:"mint"}],[{id:"job",mint:""}]]){
  payload=invalid;
  await assert.rejects(evidenceStore.nextJob(),{message:"EVIDENCE_SELECTION_INVALID"});
 }
 payload=[selected];
 assert.equal(await evidenceStore.nextJob(),selected);
});

test("health requires every nonnegative integer counter and never masks a DB failure",async()=>{
 const healthy={total:0,pending:0,verified:0,rejected:0,unavailable:0,active_leases:0,expired_leases:0,retry_exhausted:0};
 let payload=healthy,status=200;
 const evidenceStore=createHolderEvidenceStore({url:"https://database.invalid",key:"test-only",
  fetchImpl:async()=>({ok:status===200,status,json:async()=>payload})});
 assert.deepEqual(await evidenceStore.health(),healthy);
 for(const invalid of [null,{},[],{...healthy,pending:-1},{...healthy,pending:"0"},
  {...healthy,pending:true},{...healthy,pending:0.5},{...healthy,pending:Number.MAX_SAFE_INTEGER+1}]){
  payload=invalid;
  await assert.rejects(evidenceStore.health(),{message:"EVIDENCE_HEALTH_INVALID"});
 }
 for(const key of Object.keys(healthy)){
  payload={...healthy};delete payload[key];
  await assert.rejects(evidenceStore.health(),{message:"EVIDENCE_HEALTH_INVALID"});
 }
 status=503;
 await assert.rejects(evidenceStore.health(),{message:"EVIDENCE_RPC_HTTP_503"});
 await assert.rejects(evidenceStore.nextJob(),{message:"EVIDENCE_RPC_HTTP_503"});
});
