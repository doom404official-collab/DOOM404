import test from 'node:test';
import assert from 'node:assert/strict';
import {selectLiquidityContinuationCheckpoint as select} from '../lib/liquidityAutomaticCheckpointSelector.mjs';
import {assessHistorySuccessor as successor} from '../lib/liquidityHistorySuccessor.mjs';
const pool='11111111111111111111111111111111',a='1'.repeat(64),b='2'.repeat(64),c='3'.repeat(64);
const state={schemaVersion:1,pool,before:b,seen:[a,b],events:[],errors:[],pages:2,requestCount:109,pendingSignatures:[],complete:false,historyCoverageVerified:false,authorizationVerified:false,withdrawalVerified:false,finalScore:null,classification:'AMOUNT_RECONCILED_AUTHORIZATION_PENDING',reconciliation:{verifiedDistinct:34,recoveredPending:2,sourceDigest:'a'.repeat(64)},stopReason:'CHECKPOINTED'};
const old={runId:39729408869,state};
for(const missing of [undefined,null])for(const reverse of [false,true])test(`newer missing state rejects fallback ${missing} ${reverse}`,()=>{
 const entries=[old,{runId:39729408870,state:missing}];if(reverse)entries.reverse();assert.throws(()=>select(entries,pool),/NEWER_CHECKPOINT_INVALID/);
});
for(const patch of [{before:c,seen:[a,b,c],pages:3,requestCount:169},{errors:[{stage:'getTransaction'}]},{state:null}])for(const reverse of [false,true])test(`conflicting same run rejects permutation ${JSON.stringify(patch)} ${reverse}`,()=>{
 const entries=[old,{runId:old.runId,state:Object.hasOwn(patch,'state')?patch.state:{...state,...patch}}];if(reverse)entries.reverse();assert.throws(()=>select(entries,pool),/CHECKPOINT_RUN_ID_CONFLICT/);
});
test('exact duplicate observations collapse without mutation',()=>{
 const entries=[old,structuredClone(old)],before=structuredClone(entries);assert.equal(select(entries,pool).runId,old.runId);assert.deepEqual(entries,before);
});
for(const patch of [{pages:1},{pages:undefined},{pages:null},{pages:'3'},{pages:-1},{pages:1.5},{pages:Number.MAX_SAFE_INTEGER+1},{requestCount:undefined},{requestCount:'110'},{before:a},{before:c},{pages:3}])test(`counter/cursor drift rejected by successor and selector ${JSON.stringify(patch)}`,()=>{
 const next={...state,seen:[a,b,c],...patch};
 // before:c alone must not advance with a known unchanged page count.
 assert.throws(()=>successor(state,next,pool));assert.throws(()=>select([old,{runId:old.runId+1,state:next}],pool));
});
test('valid page advancement and partial-page progress retain counters',()=>{
 for(const next of [{...state,seen:[a,b,c],before:c,pages:3,requestCount:169},{...state,seen:[a,b,c],requestCount:110}]){assert.equal(successor(state,next,pool).action,'CONTINUE_BOUNDED');assert.equal(select([old,{runId:old.runId+1,state:next}],pool).runId,old.runId+1);}
});
test('legacy absent counters stay absent; later known counters cannot disappear',()=>{
 const prior={...state};delete prior.pages;delete prior.requestCount;const next={...prior,seen:[a,b,c]};assert.equal(successor(prior,next,pool).action,'CONTINUE_BOUNDED');assert.equal(next.pages,undefined);assert.equal(next.requestCount,undefined);
});
