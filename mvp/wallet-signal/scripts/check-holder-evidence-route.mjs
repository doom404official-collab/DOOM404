// Run after npm run build. Exercises the compiled POST handler with fake fetch
// responses only; credentials and endpoints below are test-only placeholders.
import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
Object.assign(process.env,{GLITCH_EVIDENCE_WORKER_ENABLED:"true",GLITCH_HOLDER_WORKER_TOKEN:"test-only-worker",
 SUPABASE_URL:"https://database.invalid",SUPABASE_SERVICE_ROLE_KEY:"test-only-key",HELIUS_RPC_URL:"https://rpc.invalid"});
const {POST}=require("../.next/server/app/api/holder-evidence-tick/route.js").routeModule.userland;
const A="3".repeat(32),B="4".repeat(32),signature="2".repeat(64);
const selected={id:"selected-job",mint:"mint-a"};
const checkpoint={version:1,mint:"mint-a",holders:[{ownerWallet:A},{ownerWallet:B}],
 wallets:{[A]:{},[B]:{}},edges:{ab:{signatures:[signature]}}};
const job={...selected,status:"partial",checkpoint};
const health={total:1,pending:0,verified:1,rejected:0,unavailable:0,active_leases:0,expired_leases:0,retry_exhausted:0};
const cases=[
 {name:"missing identity persists unavailable, never rejection",unknown:"identity",selection:[selected],rows:[job],http:200,status:"processed"},
 {name:"unresolved ownership persists unavailable, never rejection",unknown:"ownership",selection:[selected],rows:[job],http:200,status:"processed"},
 {name:"valid lease contention is explicit no-claims",selection:[selected],rows:[job],claim:[],http:200,status:"no_claims"},
 {name:"lost lease is a retryable failure, not false progress",selection:[selected],rows:[job],finish:false,http:503,code:"EVIDENCE_LEASE_LOST",afterBatch:true},
 {name:"malformed finish cannot fabricate progress",selection:[selected],rows:[job],finish:{},http:503,code:"EVIDENCE_FINISH_INVALID_RESPONSE",afterBatch:true},
 {name:"malformed seed is not successful",selection:[selected],rows:[job],seed:{},http:503,code:"EVIDENCE_SEED_INVALID_RESPONSE",afterBatch:true},
 {name:"malformed claim cannot start RPC",selection:[selected],rows:[job],claim:[{}],http:503,code:"EVIDENCE_CLAIM_INVALID_RESPONSE",afterBatch:true},
 {name:"selector database error is not idle",selectionHttp:503,http:503,code:"EVIDENCE_RPC_HTTP_503"},
 {name:"job database error is not stale success",selection:[selected],jobHttp:503,http:503,code:"HOLDER_STORE_HTTP_503"},
 {name:"health database error is not idle",selection:[],healthHttp:503,http:503,code:"EVIDENCE_RPC_HTTP_503"},
 {name:"malformed health is not idle",selection:[],health:{},http:503,code:"EVIDENCE_HEALTH_INVALID"},
 {name:"health without a selector is not healthy",selection:[],health:null,http:503,code:"EVIDENCE_HEALTH_INVALID"},
 {name:"selected snapshot processed",selection:[selected],rows:[job],http:200,status:"processed"},
 {name:"genuine idle",selection:[],http:200,status:"idle"},
 {name:"malformed selector cannot be idle",selection:[null],http:503,code:"EVIDENCE_SELECTION_INVALID"},
 {name:"missing selected job",selection:[selected],rows:[],http:503,code:"EVIDENCE_JOB_NOT_FOUND"},
 {name:"mismatched job ID",selection:[selected],rows:[{...job,id:"other"}],http:503,code:"EVIDENCE_JOB_IDENTITY_MISMATCH"},
 {name:"mismatched mint",selection:[selected],rows:[{...job,mint:"other"}],http:503,code:"EVIDENCE_JOB_IDENTITY_MISMATCH"},
 {name:"failed job",selection:[selected],rows:[{...job,status:"failed"}],http:503,code:"EVIDENCE_JOB_NOT_ELIGIBLE"},
 {name:"obsolete job",selection:[selected],rows:[{...job,status:"superseded"}],http:503,code:"EVIDENCE_JOB_NOT_ELIGIBLE"},
 {name:"foreign checkpoint",selection:[selected],rows:[{...job,checkpoint:{...checkpoint,mint:"other"}}],http:503,code:"EVIDENCE_CHECKPOINT_INVALID"},
 {name:"missing checkpoint",selection:[selected],rows:[{...job,checkpoint:null}],http:503,code:"EVIDENCE_CHECKPOINT_INVALID"},
 {name:"malformed job result",selection:[selected],rows:{},http:503,code:"INVALID_HOLDER_JOB_RESPONSE"}
];
const originalError=console.error;
for(const fixture of cases){
 const calls=[],errors=[];
 console.error=(message,details)=>errors.push({message,details});
 globalThis.fetch=async(url,options={})=>{
  const parsed=new URL(url),body=options.body?JSON.parse(options.body):null;
  calls.push({url:parsed,body});
  let result;
  if(parsed.host==="database.invalid"){
   switch(parsed.pathname){
    case "/rest/v1/rpc/glitch_next_holder_evidence_job":
     if(fixture.selectionHttp)return new Response("{}",{status:fixture.selectionHttp});
     result=fixture.selection;break;
    case "/rest/v1/glitch_holder_scan_jobs":
     if(fixture.jobHttp)return new Response("{}",{status:fixture.jobHttp});
     assert.equal(options.method,"GET");
     assert.equal(parsed.searchParams.get("id"),"eq."+selected.id);
     assert.equal(parsed.searchParams.has("mint"),false,"Must not use a competing checkpoint's recency");
     result=fixture.rows;break;
    case "/rest/v1/rpc/glitch_holder_evidence_health":
     if(fixture.healthHttp)return new Response("{}",{status:fixture.healthHttp});
     if(Object.hasOwn(fixture,"health")){result=fixture.health;break;}
     result=fixture.status==="idle"?Object.fromEntries(Object.keys(health).map(key=>[key,0])):health;break;
    case "/rest/v1/rpc/glitch_seed_holder_evidence":assert.equal(body.p_job_id,selected.id);result=Object.hasOwn(fixture,"seed")?fixture.seed:1;break;
    case "/rest/v1/rpc/glitch_claim_holder_evidence":assert.equal(body.p_job_id,selected.id);result=fixture.claim??[{signature,attempts:0}];break;
    case "/rest/v1/rpc/glitch_finish_holder_evidence":
     assert.equal(body.p_job_id,selected.id);assert.equal(body.p_signature,signature);
     assert.equal(body.p_status,fixture.unknown?"unavailable":"verified");assert.deepEqual(body.p_evidence.pairs,fixture.unknown?[]:[A+"|"+B]);result=Object.hasOwn(fixture,"finish")?fixture.finish:true;break;
    default:assert.fail("Unexpected database call in no-network test: "+parsed.pathname);
   }
  }else if(parsed.host==="rpc.invalid"){
   assert.equal(body.method,"getTransaction");assert.equal(body.params[0],signature);
   result={result:{slot:12,meta:{err:null,innerInstructions:[]},transaction:{signatures:[signature],message:{accountKeys:[],instructions:[
    {programId:"11111111111111111111111111111111",program:"system",parsed:{type:"transfer",info:{source:A,destination:B,lamports:100}}}
   ]}}}};
   if(fixture.unknown==='identity')delete result.result.transaction.signatures;
   if(fixture.unknown==='ownership')result.result.transaction.message.instructions=[{programId:'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',parsed:{type:'transfer',info:{source:A,destination:B,amount:'10'}}}];
  }else assert.fail("Network forbidden: unexpected host");
  return new Response(JSON.stringify(result),{status:200,headers:{"Content-Type":"application/json"}});
 };
 const response=await POST(new Request("https://preview.invalid/api/holder-evidence-tick",{
  method:"POST",headers:{"x-glitch-worker-token":"test-only-worker"},body:"{}"}));
 const result=await response.json();
 assert.equal(response.status,fixture.http,fixture.name);
 if(fixture.code){
  assert.equal(result.code,fixture.code,fixture.name);
  if(!fixture.afterBatch){
   assert.equal(calls.some(call=>call.url.host==="rpc.invalid"),false);
   assert.equal(calls.some(call=>/glitch_(seed|claim|finish)_holder_evidence/.test(call.url.pathname)),false);
  }
  assert.equal(errors.length,1);
  assert.deepEqual(Object.keys(errors[0].details),["stage","code"]);
 }else{
  assert.equal(result.status,fixture.status);
  assert.equal(result.processed,fixture.status==="processed"?1:0);
  assert.equal(result.requestCount,fixture.status==="processed"?1:0);
  assert.ok(result.health);
  assert.equal(errors.length,0);
 }
 console.log("PASS:",fixture.name);
}
console.error=originalError;
console.log(`Compiled evidence route: ${cases.length} no-network cases passed`);
