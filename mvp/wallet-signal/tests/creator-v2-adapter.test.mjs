import test from 'node:test';
import assert from 'node:assert/strict';
import {createCreatorIntelligenceJobStoreV2 as create} from '../lib/creatorIntelligenceJobStoreV2.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump',owner='offline-owner-a',start=Date.parse('2026-10-27T14:00:00Z');
function fixture(hook=()=>{}){
 let now=start,row={mint,status:'partial',stage:'selling',state:{retained:['one'],raw:'900719925474099312345'},request_count_total:'7189',lease_owner:null,lease_until:null,revision:'0',created_at:'2026-10-22T10:00:00+00:00',updated_at:'2026-10-22T10:00:00+00:00'};
 const calls=[];
 const fetchImpl=async(url,options)=>{
  const call={url,options,body:options.body?JSON.parse(options.body):null};calls.push(call);
  const override=await hook(call,{row,calls,setRow:value=>{row=value;}});if(override)return override;
  if(options.method==='GET')return {ok:true,json:async()=>[structuredClone(row)]};
  const p=call.body;
  assert.ok(url.endsWith('_v2'));assert.equal(p.p_mint,mint);
  if(p.p_expected_revision!==row.revision)return {ok:true,json:async()=>null};
  if(url.includes('claim_'))row={...row,status:'running',lease_owner:p.p_owner,lease_until:new Date(now+p.p_lease_seconds*1000).toISOString(),revision:(BigInt(row.revision)+1n).toString()};
  else row={...row,status:p.p_status,stage:p.p_stage,state:structuredClone(p.p_state),request_count_total:(BigInt(row.request_count_total)+BigInt(p.p_request_delta)).toString(),revision:(BigInt(row.revision)+1n).toString(),...(p.p_status==='running'?{}:{lease_owner:null,lease_until:null})};
  return {ok:true,json:async()=>({mint,owner:row.lease_owner,leaseUntil:row.lease_until,revision:row.revision,status:row.status})};
 };
 const store=create({enabled:true,url:'https://test.supabase.co',key:'offline-only',fetchImpl,now:()=>now});
 return {store,calls,fetchImpl,get row(){return row},set row(value){row=value},advance:ms=>now+=ms,
  async claim(){await store.read(mint);return store.claim({mint,owner,expectedRevision:row.revision})},
  saveArgs(changes={}){return {mint,owner,expectedRevision:row.revision,leaseUntil:row.lease_until,stage:'selling',state:{retained:['one','two'],raw:'900719925474099312345'},requestCount:1,...changes}}};
}
test('V2 is disabled by default and truthy configuration cannot activate it',()=>{
 let calls=0;
 for(const enabled of [undefined,false,'true',1,null])assert.throws(()=>create({enabled,fetchImpl:()=>{calls++;}}),{message:'CREATOR_V2_DISABLED'});
 assert.equal(calls,0);
});
test('exact read/claim/reread and sequential running/final save preserve source and decimal metadata',async()=>{
 const h=fixture(),before=structuredClone(h.row);const claimed=await h.claim();
 assert.deepEqual(claimed.job.state,before.state);assert.equal(claimed.receipt.revision,'1');
 const select=new URL(h.calls[0].url).searchParams.get('select');assert.ok(select.includes('revision::text'));assert.ok(select.includes('request_count_total::text'));
 assert.deepEqual(h.calls.map(c=>c.options.method),['GET','POST','GET']);assert.equal(h.calls[1].body.p_expected_revision,'0');
 const args=h.saveArgs({status:'running'}),source=structuredClone(args.state);const saved=await h.store.save(args);
 assert.equal(saved.revision,'2');assert.equal(saved.leaseUntil,claimed.receipt.leaseUntil);assert.deepEqual(args.state,source);
 const final=await h.store.save(h.saveArgs());assert.equal(final.revision,'3');assert.equal(final.owner,null);assert.equal(final.leaseUntil,null);assert.equal(h.row.request_count_total,'7191');
 assert.ok(h.calls.every(c=>c.options.cache==='no-store'));assert.ok(h.calls.filter(c=>c.options.method==='POST').every(c=>c.url.endsWith('_v2')));
 assert.equal(h.store.enqueue,undefined);assert.equal(h.store.get,undefined);
});
for(const bad of [0,1,9007199254740992,1n,'','01','-1','+1','1.0','1e3',' 1','9223372036854775808','9223372036854775807'])test('claim rejects noncanonical/unincrementable revision '+String(bad),async()=>{
 const h=fixture();await h.store.read(mint);const count=h.calls.length;
 await assert.rejects(h.store.claim({mint,owner,expectedRevision:bad}),{message:'CREATOR_V2_INVALID_REVISION'});assert.equal(h.calls.length,count);
});
test('large decimal revisions remain exact without numeric conversion',async()=>{
 const h=fixture();h.row={...h.row,revision:'9007199254740992'};const result=await h.claim();assert.equal(result.receipt.revision,'9007199254740993');
 const saved=await h.store.save(h.saveArgs());assert.equal(saved.revision,'9007199254740994');
});
for(const changes of [{mint:'other'},{revision:0},{revision:'01'},{request_count_total:7189},{state:[]},{lease_owner:owner},{lease_until:'bad'},{created_at:'2026-02-30T00:00:00Z'},{updated_at:'2026-10-27T24:00:00Z'}])test('read rejects incompatible row '+JSON.stringify(changes),async()=>{
 const h=fixture();h.row={...h.row,...changes};await assert.rejects(h.store.read(mint),/^Error: CREATOR_V2_/);assert.equal(h.calls.length,1);
});
for(const change of [{mint:'other'},{owner:'other-owner'},{status:'partial'},{revision:'0'},{revision:'2'},{revision:1},{revision:'01'},{leaseUntil:'2026-10-27T13:59:59Z'},{leaseUntil:'2026-10-27T14:03:01Z'},{leaseUntil:'not-time'},{extra:'raw-state'}])test('malformed claim receipt poisons writes without fallback '+JSON.stringify(change),async()=>{
 const h=fixture(call=>call.url.includes('claim_')?{ok:true,json:async()=>({mint,owner,status:'running',revision:'1',leaseUntil:'2026-10-27T14:03:00.000Z',...change})}:null);
 await assert.rejects(h.claim(),{message:'CREATOR_V2_WRITE_OUTCOME_UNKNOWN'});const count=h.calls.length;
 await assert.rejects(h.store.claim({mint,owner,expectedRevision:'0'}),{message:'CREATOR_V2_RECONCILIATION_REQUIRED'});assert.equal(h.calls.length,count);
});
for(const field of ['state','revision','lease_owner','lease_until','request_count_total','stage','created_at'])test('post-claim changed '+field+' requires reconciliation',async()=>{
 const h=fixture((call,context)=>{
  if(call.options.method!=='GET'||context.calls.length!==3)return;
  const row=structuredClone(context.row);row[field]=field==='state'?{changed:true}:field==='revision'?'2':field==='lease_owner'?'another-owner':field==='lease_until'?'2026-10-27T14:02:59.000Z':field==='request_count_total'?'7190':field==='stage'?'holdings':'2026-10-21T10:00:00+00:00';
  return {ok:true,json:async()=>[row]};
 });
 await assert.rejects(h.claim(),{message:'CREATOR_V2_CLAIM_RECONCILIATION_REQUIRED'});assert.equal(h.store.reconciliationRequired,true);assert.equal(h.calls.length,3);
});
test('missing preflight read and stale revisions cause zero writes',async()=>{
 const h=fixture();await assert.rejects(h.store.claim({mint,owner,expectedRevision:'0'}),{message:'CREATOR_V2_READ_REQUIRED'});assert.equal(h.calls.length,0);
 await h.store.read(mint);await assert.rejects(h.store.claim({mint,owner,expectedRevision:'1'}),{message:'CREATOR_V2_READ_REQUIRED'});assert.equal(h.calls.length,1);
});
test('expired lease and wrong session metadata cannot send a save',async()=>{
 const h=fixture();await h.claim();const count=h.calls.length;
 for(const change of [{expectedRevision:'0'},{owner:'different-owner'},{leaseUntil:'2026-10-27T14:02:59.000Z'},{requestCount:501},{status:'queued'},{state:[]}])await assert.rejects(h.store.save(h.saveArgs(change)),/^Error: CREATOR_V2_/);
 h.advance(180000);await assert.rejects(h.store.save(h.saveArgs()),{message:'CREATOR_V2_LEASE_INVALID'});assert.equal(h.calls.length,count);
});
for(const failure of ['http','transport','json','null','malformed'])test('save '+failure+' stops without retry or legacy fallback',async()=>{
 const h=fixture(call=>{
  if(!call.url.includes('save_'))return;
  if(failure==='transport')throw Error('private transport detail');
  return {ok:failure!=='http',json:async()=>{if(failure==='json')throw Error('private JSON');return failure==='null'?null:{revision:2}}};
 });
 await h.claim();await assert.rejects(h.store.save(h.saveArgs()),{message:failure==='null'?'CREATOR_V2_CONFLICT':'CREATOR_V2_WRITE_OUTCOME_UNKNOWN'});
 const count=h.calls.length;await assert.rejects(h.store.save(h.saveArgs()),{message:'CREATOR_V2_RECONCILIATION_REQUIRED'});assert.equal(h.calls.length,count);
 assert.equal(h.calls.filter(c=>c.url.includes('save_')).length,1);
});
test('serialization crossing lease expiry sends no write',async()=>{
 const h=fixture();await h.claim();const count=h.calls.length;
 await assert.rejects(h.store.save(h.saveArgs({state:{toJSON(){h.advance(180000);return {retained:true}}}})),{message:'CREATOR_V2_REQUEST_NOT_SENT'});assert.equal(h.calls.length,count);
});
test('cancelled save does not parse late response or retry',async()=>{
 let release,started,parsed=0;const ready=new Promise(resolve=>started=resolve);
 const h=fixture(async call=>{if(call.url.includes('save_')){started();return new Promise(resolve=>release=resolve);}});await h.claim();
 const controller=new AbortController(),pending=h.store.save(h.saveArgs(),{signal:controller.signal});await ready;controller.abort();
 await assert.rejects(pending,{message:'CREATOR_V2_WRITE_OUTCOME_UNKNOWN'});
 release({ok:true,json:async()=>{parsed++;return true}});await new Promise(resolve=>setImmediate(resolve));assert.equal(parsed,0);assert.equal(h.store.reconciliationRequired,true);
});
test('overlapping writes on one adapter cannot send a second POST',async()=>{
 let release,started;const ready=new Promise(resolve=>started=resolve);
 const h=fixture(async call=>{if(call.url.includes('save_')){started();return new Promise(resolve=>release=resolve);}});await h.claim();
 const pending=h.store.save(h.saveArgs());await ready;const count=h.calls.length;
 await assert.rejects(h.store.save(h.saveArgs()),{message:'CREATOR_V2_WRITE_IN_FLIGHT'});assert.equal(h.calls.length,count);
 release({ok:true,json:async()=>({mint,owner:null,status:'partial',revision:'2',leaseUntil:null})});await pending;
});
for(const change of [{mint:'other'},{owner:'wrong-owner'},{status:'complete'},{revision:'3'},{revision:2},{leaseUntil:'2026-10-27T14:03:00.001Z'}])test('running save receipt identity and expiry must match '+JSON.stringify(change),async()=>{
 const h=fixture(call=>call.url.includes('save_')?{ok:true,json:async()=>({mint,owner,status:'running',revision:'2',leaseUntil:'2026-10-27T14:03:00.000Z',...change})}:null);
 await h.claim();await assert.rejects(h.store.save(h.saveArgs({status:'running'})),{message:'CREATOR_V2_WRITE_OUTCOME_UNKNOWN'});assert.equal(h.store.reconciliationRequired,true);
});
test('read-only reconciliation cannot silently unblock an uncertain adapter',async()=>{
 const h=fixture(call=>call.url.includes('save_')?{ok:false}:null);await h.claim();
 await assert.rejects(h.store.save(h.saveArgs()),{message:'CREATOR_V2_WRITE_OUTCOME_UNKNOWN'});await h.store.read(mint);const count=h.calls.length;
 await assert.rejects(h.store.claim({mint,owner,expectedRevision:h.row.revision}),{message:'CREATOR_V2_RECONCILIATION_REQUIRED'});assert.equal(h.calls.length,count);
});
test('mutating a caller read snapshot cannot alter the retained pre-claim comparison',async()=>{
 const h=fixture();const row=await h.store.read(mint);row.state.retained.push('caller-mutation');
 const result=await h.store.claim({mint,owner,expectedRevision:'0'});assert.deepEqual(result.job.state.retained,['one']);
});
