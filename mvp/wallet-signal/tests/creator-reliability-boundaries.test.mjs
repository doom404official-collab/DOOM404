import test from 'node:test';
import assert from 'node:assert/strict';
import {createCreatorExecutionBudget} from '../lib/creatorExecutionBudget.mjs';
import {createCreatorIntelligenceJobStore} from '../lib/creatorIntelligenceJobStore.mjs';
import {runCreatorIntelligenceTick} from '../lib/creatorIntelligenceTick.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump',creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC',owner='offline-worker';
function clock(){let time=0;return {advance:n=>time+=n,budget:createCreatorExecutionBudget({now:()=>time,schedule:()=>0,cancel:()=>{}})};}
function harness(stage='selling'){
 let state={originEvidence:[{creator}],launchTimestamp:100,creatorPendingSignatures:[],creatorVerifiedAcquisitionEvents:[],priorEvidence:{unchanged:true}};
 let saves=0,claims=0;
 class Store{owner=null;async get(){return {mint,status:'partial',stage,state,lease_owner:this.owner}}async claim(_mint,owner){claims++;this.owner=owner;return true}async save(v){assert.ok(this instanceof Store);saves++;state=v.state;return true}}
 return {store:new Store(),get state(){return state},get saves(){return saves},get claims(){return claims}};
}
test('provider deadline includes synchronous parsing and leaves persistence time without more provider calls',async()=>{
 const c=clock(),h=harness();let calls=0,signal;
 const result=await runCreatorIntelligenceTick({mint,owner,store:h.store,rpcUrl:'https://offline.invalid',executionBudget:c.budget,fetchImpl:async(_,o)=>{
  calls++;signal=o.signal;return {ok:true,json:async()=>{c.advance(76000);return {result:[]}}};
 }});
 assert.equal(calls,1);assert.equal(signal.aborted,true);assert.equal(result.errorCode,'CREATOR_PROVIDER_TIMEOUT');
 assert.equal(h.saves,1);assert.deepEqual(h.state.priorEvidence,{unchanged:true});assert.equal(h.state.creatorHistoryComplete,undefined);
 await assert.rejects(c.budget.run('PROVIDER',()=>{calls++;},{provider:true}),/CREATOR_PROVIDER_TIMEOUT/);assert.equal(calls,1);
});
test('slow read prevents claim; slow claim is uncertain and cannot reach provider or save',async()=>{
 for(const phase of ['get','claim']){
  const c=clock(),h=harness(),original=h.store[phase].bind(h.store);let calls=0;
  h.store[phase]=async(...args)=>{const result=await original(...args);c.advance(16000);return result;};
  await assert.rejects(runCreatorIntelligenceTick({mint,owner,store:h.store,rpcUrl:'https://offline.invalid',executionBudget:c.budget,fetchImpl:async()=>{calls++;}}),phase==='get'?/CREATOR_READ_TIMEOUT/:/CREATOR_CLAIM_OUTCOME_UNKNOWN/);
  assert.equal(calls,0);assert.equal(h.saves,0);assert.equal(h.claims,phase==='get'?0:1);
 }
});
test('uncertain indexed reservation never triggers a second save or any paid provider call',async()=>{
 for(const failure of ['CREATOR_SAVE_OUTCOME_UNKNOWN','CREATOR_LEASE_LOST']){
  const h=harness('identification');let saves=0,calls=0;
  h.store.save=async()=>{saves++;throw Error(failure)};
  await assert.rejects(runCreatorIntelligenceTick({mint,owner,store:h.store,indexedOriginEnabled:true,rpcUrl:'https://offline.invalid',fetchImpl:async()=>{calls++;}}),new RegExp(failure));
  assert.equal(saves,1);assert.equal(calls,0);
 }
});
test('post-provider uncertain checkpoint response also stops all additional writes',async()=>{
 const h=harness('identification');let saves=0,calls=0;
 h.store.save=async()=>{if(++saves===2)throw Error('CREATOR_SAVE_OUTCOME_UNKNOWN');return true;};
 await assert.rejects(runCreatorIntelligenceTick({mint,owner,store:h.store,indexedOriginEnabled:true,rpcUrl:'https://offline.invalid',fetchImpl:async(_,o)=>{
  assert.equal(JSON.parse(o.body).method,'getTransactionsForAddress');calls++;return {ok:true,json:async()=>({result:{data:[]}})};
 }}),/CREATOR_SAVE_OUTCOME_UNKNOWN/);
 assert.equal(saves,2);assert.equal(calls,1);
});
test('timeout after a possibly successful final commit remains uncertain and is never retried',async()=>{
 const c=clock(),h=harness();let saves=0;
 h.store.save=async()=>{saves++;c.advance(16000);return true;};
 await assert.rejects(runCreatorIntelligenceTick({mint,owner,store:h.store,rpcUrl:'https://offline.invalid',executionBudget:c.budget,fetchImpl:async()=>({ok:true,json:async()=>({result:[]})})}),/CREATOR_SAVE_OUTCOME_UNKNOWN/);
 assert.equal(saves,1);
});
test('request timeout aborts a noncooperative operation and releases its timer',async()=>{
 let callback,cancelled=false,signal;
 const budget=createCreatorExecutionBudget({schedule:fn=>{callback=fn;return 1},cancel:id=>{assert.equal(id,1);cancelled=true}});
 const pending=budget.run('PROVIDER',s=>{signal=s;return new Promise(()=>{});},{provider:true});
 await Promise.resolve();callback();await assert.rejects(pending,/CREATOR_PROVIDER_TIMEOUT/);
 assert.equal(signal.aborted,true);assert.equal(cancelled,true);
});
test('store rejects wrong identity, malformed read/claim responses, and distinguishes lease loss from uncertain save',async()=>{
 let response=[],calls=0;
 const store=createCreatorIntelligenceJobStore({url:'https://test.supabase.co',key:'offline-key',fetchImpl:async()=>{calls++;return {ok:true,json:async()=>response}}});
 for(const bad of [{},[{},{}],[{mint:'wrong',stage:'selling',status:'partial',state:{}}],[{mint,stage:'selling',status:'partial',state:[]}]]){
  response=bad;await assert.rejects(store.get(mint),/CREATOR_STORE_INVALID/);
 }
 for(const bad of [null,[],{},'true']){response=bad;await assert.rejects(store.claim(mint,owner),/CREATOR_CLAIM_OUTCOME_UNKNOWN/);}
 const value={mint,owner,stage:'selling',state:{}};
 response=false;await assert.rejects(store.save(value),/CREATOR_LEASE_LOST/);
 response=null;await assert.rejects(store.save(value),/CREATOR_SAVE_OUTCOME_UNKNOWN/);
 response=true;assert.equal(await store.save(value),true);
 const before=calls;await assert.rejects(store.claim(mint,owner,181),/INVALID_CREATOR_LEASE/);assert.equal(calls,before);
});
test('store transport and JSON errors produce redacted unknown-write outcomes with no retry',async()=>{
 for(const failure of ['transport','json','http']){
  let calls=0;
  const store=createCreatorIntelligenceJobStore({url:'https://test.supabase.co',key:'secret',fetchImpl:async()=>{
   calls++;if(failure==='transport')throw Error('private endpoint');return {ok:failure!=='http',status:503,json:async()=>{throw Error('private checkpoint')}};
  }});
  await assert.rejects(store.save({mint,owner,stage:'selling',state:{}}),{message:'CREATOR_SAVE_OUTCOME_UNKNOWN'});assert.equal(calls,1);
 }
});

test('atomic claim contention permits only one tick; post-claim checkpoint is authoritative',async()=>{
 const h=harness();let claimed=false,calls=0;
 h.store.claim=async(_mint,owner)=>{if(claimed)return false;claimed=true;h.store.owner=owner;h.state.priorEvidence.afterClaim=true;return true;};
 const args={mint,store:h.store,rpcUrl:'https://offline.invalid',fetchImpl:async()=>{calls++;return {ok:true,json:async()=>({result:[]})}}};
 const results=await Promise.all([runCreatorIntelligenceTick(args),runCreatorIntelligenceTick(args)]);
 assert.equal(results.filter(r=>r.status==='busy').length,1);assert.equal(calls,1);assert.equal(h.saves,1);assert.equal(h.state.priorEvidence.afterClaim,true);
});
test('interrupted provider work preserves pending signatures for the next independent tick',async()=>{
 const h=harness(),c=clock();h.state.creatorPendingSignatures=['2'.repeat(88)];let calls=0;
 await runCreatorIntelligenceTick({mint,store:h.store,rpcUrl:'https://offline.invalid',executionBudget:c.budget,fetchImpl:async(_,o)=>{
  const method=JSON.parse(o.body).method;calls++;if(method==='getTransaction')c.advance(76000);
  return {ok:true,json:async()=>({result:method==='getTransaction'?null:[]})};
 }});
 assert.deepEqual(h.state.creatorPendingSignatures,['2'.repeat(88)]);assert.equal(h.state.creatorHistoryComplete,false);assert.equal(calls,2);
 const methods=[];await runCreatorIntelligenceTick({mint,store:h.store,rpcUrl:'https://offline.invalid',fetchImpl:async(_,o)=>{methods.push(JSON.parse(o.body).method);return {ok:true,json:async()=>({result:methods.at(-1)==='getTransaction'?null:[]})}}});
 assert.deepEqual(methods,['getSignaturesForAddress','getTransaction']);assert.deepEqual(h.state.creatorPendingSignatures,['2'.repeat(88)]);
});
test('origin retention rejects overflow and unverifiable legacy boundaries without pruning evidence',async()=>{
 const {assertCreatorRetention}=await import('../lib/creatorRetentionIntegrity.mjs');
 for(const [field,limit] of Object.entries({indexedOriginCandidates:50,indexedOriginChecked:1000,indexedOriginDeferred:1000,deferredSignatures:1000,originEvidence:100})){
  const rows=Array.from({length:limit},(_,i)=>'retained-'+i),state={[field]:rows};
  assert.throws(()=>assertCreatorRetention(state,{legacy:true}),/CREATOR_RETENTION_BLOCKED/);
  assert.doesNotThrow(()=>assertCreatorRetention({...state,creatorOriginRetentionVersion:1},{legacy:true}));
  assert.throws(()=>assertCreatorRetention({[field]:[...rows,'overflow']}),/CREATOR_RETENTION_BLOCKED/);
  assert.equal(rows.length,limit);
 }
 const h=harness('identification');h.state.indexedOriginCandidates=Array.from({length:50},(_,i)=>({signature:String(i)}));let calls=0;
 const original=structuredClone(h.state.indexedOriginCandidates);
 const result=await runCreatorIntelligenceTick({mint,store:h.store,rpcUrl:'https://offline.invalid',fetchImpl:async()=>{calls++;}});
 assert.equal(result.errorCode,'CREATOR_RETENTION_BLOCKED');assert.equal(calls,0);assert.deepEqual(h.state.indexedOriginCandidates,original);
});

test('read errors cannot expose response text or credentials through worker error output',async()=>{
 const store=createCreatorIntelligenceJobStore({url:'https://test.supabase.co',key:'private-key',fetchImpl:async()=>({ok:true,json:async()=>{throw Error('private-checkpoint-content')}})});
 await assert.rejects(store.get(mint),{message:'CREATOR_STORE_READ_FAILED'});
});
test('long checkpoint serialization checks the caller deadline before transport',async()=>{
 const c=clock();let calls=0;
 const store=createCreatorIntelligenceJobStore({url:'https://test.supabase.co',key:'offline',fetchImpl:async()=>{calls++;return {ok:true,json:async()=>true}}});
 await assert.rejects(c.budget.run('SAVE',signal=>store.save({mint,owner,stage:'selling',state:{toJSON(){c.advance(16000);return {history:'retained'}}}},{signal})),/CREATOR_SAVE_TIMEOUT/);
 assert.equal(calls,0);
});

test('real store rows require owner metadata and post-claim null/foreign owner prevents downstream work',async()=>{
 let row={mint,status:'partial',stage:'selling',state:{}};
 const store=createCreatorIntelligenceJobStore({url:'https://test.supabase.co',key:'offline',fetchImpl:async()=>({ok:true,json:async()=>[row]})});
 await assert.rejects(store.get(mint),/CREATOR_STORE_INVALID_ROW/);
 row={...row,lease_owner:null};assert.deepEqual(await store.get(mint),row);
 for(const lease_owner of [null,'different-worker']){
  let calls=0,saves=0;
  await assert.rejects(runCreatorIntelligenceTick({mint,owner,store:{get:async()=>({...row,lease_owner}),claim:async()=>true,save:async()=>{saves++;}},rpcUrl:'https://offline.invalid',fetchImpl:async()=>{calls++;}}),/CREATOR_LEASE_MISMATCH/);
  assert.equal(calls,0);assert.equal(saves,0);
 }
});

test('retention overflow after indexed lookup preserves its acknowledged reservation and prevents replay',async()=>{
 const h=harness('identification');h.state.indexedOriginCandidates=Array.from({length:49},(_,i)=>({signature:'old-'+i}));
 const prior=structuredClone(h.state.indexedOriginCandidates);let calls=0;
 const args={mint,store:h.store,rpcUrl:'https://offline.invalid',indexedOriginEnabled:true,fetchImpl:async(_,o)=>{
  assert.equal(JSON.parse(o.body).method,'getTransactionsForAddress');calls++;
  return {ok:true,json:async()=>({result:{data:[{signature:'new-a'},{signature:'new-b'}]}})};
 }};
 const result=await runCreatorIntelligenceTick(args);
 assert.equal(result.errorCode,'CREATOR_RETENTION_BLOCKED');assert.equal(calls,1);assert.equal(h.saves,2);
 assert.deepEqual(h.state.indexedOriginCandidates,prior);assert.equal(h.state.indexedOriginLookupAttempted,true);assert.equal(h.state.indexedOriginProviderStatus,'RESERVED');
 await runCreatorIntelligenceTick(args);assert.equal(calls,1);assert.equal(h.state.indexedOriginLookupAttempted,true);
});
