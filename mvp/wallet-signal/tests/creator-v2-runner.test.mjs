import {createCreatorExecutionBudget} from '../lib/creatorExecutionBudget.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {runCreatorIntelligenceV2 as run} from '../lib/creatorIntelligenceRunnerV2.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
function harness(failSave=0){
 let time=Date.now(),saves=0,calls=0,io=0;
 let row={mint,status:'partial',stage:'identification',state:{retained:{raw:'9007199254740993'}},revision:'0',request_count_total:'7189',lease_owner:null,lease_until:null,created_at:new Date(time).toISOString(),updated_at:new Date(time).toISOString()};
 const revisions=[];
 const options={enabled:true,mint,owner:'offline-runner',rpcUrl:'https://offline.invalid',maxRequests:2,indexedOriginEnabled:true,storeConfig:{url:'https://test.supabase.co',key:'offline',now:()=>time,fetchImpl:async(url,o)=>{
  io++;if(o.method==='GET')return {ok:true,json:async()=>[structuredClone(row)]};
  const p=JSON.parse(o.body);assert.equal(p.p_expected_revision,row.revision);revisions.push(p.p_expected_revision);
  if(url.includes('claim_'))row={...row,status:'running',lease_owner:p.p_owner,lease_until:new Date(time+180000).toISOString()};
  else{if(++saves===failSave)throw Error('uncertain');row={...row,state:p.p_state,stage:p.p_stage,status:p.p_status,request_count_total:String(BigInt(row.request_count_total)+BigInt(p.p_request_delta)),...(p.p_status==='running'?{}:{lease_owner:null,lease_until:null})};}
  row.revision=String(BigInt(row.revision)+1n);
  return {ok:true,json:async()=>({mint,owner:row.lease_owner,leaseUntil:row.lease_until,revision:row.revision,status:row.status})};
 }},fetchImpl:async(_,o)=>{calls++;const method=JSON.parse(o.body).method;return {ok:true,json:async()=>({result:method==='getTransactionsForAddress'?{data:[]}:[]})};}};
 return {options,revisions,get row(){return row},get saves(){return saves},get calls(){return calls},get io(){return io},advance:n=>time+=n};
}
test('runner disabled and invalid configuration do not touch storage',async()=>{
 const h=harness();for(const enabled of [undefined,false,'true',1])await assert.rejects(run({...h.options,enabled}),/RUNNER_DISABLED/);
 await assert.rejects(run({...h.options,maxRequests:0}),/BUDGET/);assert.equal(h.io,0);
});
test('real tick consumes each revision, reserves paid call and resumes without repeating it',async()=>{
 const h=harness();const first=await run(h.options);assert.deepEqual(h.revisions,['0','1','2','3']);assert.equal(first.revision,'4');assert.equal(h.calls,2);assert.equal(h.row.request_count_total,'7191');assert.equal(h.row.state.indexedOriginLookupAttempted,true);assert.deepEqual(h.row.state.retained,{raw:'9007199254740993'});
 const second=await run(h.options);assert.equal(second.revision,'6');assert.deepEqual(h.revisions,['0','1','2','3','4','5']);assert.equal(h.calls,3);assert.equal(h.row.state.historyComplete,false);
});
for(const [save,calls] of [[1,0],[2,1],[3,2]])test('uncertain save '+save+' stops without another write',async()=>{
 const h=harness(save);await assert.rejects(run(h.options),/WRITE_OUTCOME_UNKNOWN/);assert.equal(h.saves,save);assert.equal(h.calls,calls);
});
test('429 sends no automatic retry or later provider request',async()=>{
 const h=harness();let calls=0;h.options.fetchImpl=async()=>{calls++;return {ok:false,status:429}};await run(h.options);assert.equal(calls,1);assert.notEqual(h.row.state.historyComplete,true);
});
test('lease expiry during provider response cannot save or continue',async()=>{
 const h=harness();let calls=0;h.options.fetchImpl=async()=>{calls++;h.advance(180001);return {ok:true,json:async()=>({result:[]})}};
 await assert.rejects(run(h.options),/LEASE_INVALID/);assert.equal(calls,1);assert.equal(h.saves,1);assert.equal(h.row.state.indexedOriginLookupAttempted,true);
});

for(const field of ['revision','lease_owner','state','lease_until'])test('runner rejects altered post-claim '+field+' before provider',async()=>{
 const h=harness(),original=h.options.storeConfig.fetchImpl;let reads=0;
 h.options.storeConfig.fetchImpl=async(u,o)=>{const response=await original(u,o);if(o.method==='GET'&&++reads===2){const rows=await response.json();rows[0][field]=field==='state'?{changed:true}:field==='lease_until'?'2000-01-01T00:00:00Z':'wrong';return {ok:true,json:async()=>rows};}return response;};
 await assert.rejects(run(h.options),/RECONCILIATION_REQUIRED/);assert.equal(h.calls,0);assert.equal(h.saves,0);
});
test('missing job is never enqueued',async()=>{const h=harness();h.options.storeConfig.fetchImpl=async()=>({ok:true,json:async()=>[]});await assert.rejects(run(h.options),/NOT_ENQUEUED/);assert.equal(h.calls,0);});

test('malformed provider JSON stops all subsequent transport calls',async()=>{
 const h=harness();let calls=0,parses=0;h.options.fetchImpl=async()=>{calls++;return {ok:true,json:async()=>{parses++;throw new SyntaxError('synthetic malformed JSON');}}};
 await run(h.options);assert.equal(calls,1);assert.equal(parses,1);assert.notEqual(h.row.state.historyComplete,true);assert.equal(h.row.state.indexedOriginLookupAttempted,true);
});
for(const phase of ['headers','body'])test('late '+phase+' failure cannot restart provider work',async()=>{
 const h=harness();let calls=0,parses=0;
 h.options.executionBudget=createCreatorExecutionBudget({schedule:fn=>setTimeout(fn,10)});
 h.options.fetchImpl=async()=>{calls++;if(phase==='headers')await new Promise(r=>setTimeout(r,50));return {ok:true,json:async()=>{parses++;await new Promise(r=>setTimeout(r,50));throw Error('late synthetic failure');}}};
 await run(h.options);const saves=h.saves;await new Promise(r=>setTimeout(r,100));
 assert.equal(calls,1);assert.equal(parses,phase==='headers'?0:1);assert.equal(h.saves,saves);assert.notEqual(h.row.state.historyComplete,true);assert.equal(h.row.state.indexedOriginLookupAttempted,true);
});
