import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateLiquidityRuntimeContract as evaluate} from '../lib/liquidityAutoWorkerRuntimeContract.mjs';
const pool='11111111111111111111111111111111';
const state={schemaVersion:1,pool,before:'1'.repeat(64),seen:['1'.repeat(64)],events:[],pendingSignatures:[],complete:false,historyCoverageVerified:false,authorizationVerified:false,withdrawalVerified:false,finalScore:null,classification:'AMOUNT_RECONCILED_AUTHORIZATION_PENDING',reconciliation:{verifiedDistinct:34,recoveredPending:2,sourceDigest:'a'.repeat(64)},stopReason:'CHECKPOINTED'};
const args={pool,candidates:[{runId:39729408869,state}]};
test('bounded dry run never enables live execution',()=>{
 const x=evaluate({...args,requestCount:25});
 assert.equal(x.action,'DRY_RUN_ONLY');assert.equal(x.requestsAllowed,35);
 assert.equal(x.liveExecutionEnabled,false);assert.equal(x.checkpointPromotionEnabled,false);
});
test('request exhaustion, concurrency and unsafe evidence fail closed',()=>{
 assert.equal(evaluate({...args,requestCount:60}).requestsAllowed,0);
 assert.throws(()=>evaluate({...args,activeWorkers:2}));
 assert.throws(()=>evaluate({...args,candidates:[{runId:39729408869,state:{...state,finalScore:12}}]}));
});

test('explicit pause and verified completion never allow RPC',()=>{
 const paused={...state,stopReason:'RETRIEVAL_INCOMPLETE'};
 assert.equal(evaluate({...args,candidates:[{runId:39729408869,state:paused}]}).requestsAllowed,0);
 const done={...state,complete:true,historyCoverageVerified:true};
 const result=evaluate({...args,candidates:[{runId:39729408869,state:done}]});
 assert.equal(result.action,'STOP_COMPLETE');assert.equal(result.requestsAllowed,0);
});
