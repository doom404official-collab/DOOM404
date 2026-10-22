import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateBoundedExecution as execute} from '../lib/liquidityAutoExecutionContract.mjs';
const pool='11111111111111111111111111111111',a='1'.repeat(64),b='2'.repeat(64);
const state={schemaVersion:1,pool,before:a,seen:[a],events:[],pendingSignatures:[],complete:false,historyCoverageVerified:false,authorizationVerified:false,withdrawalVerified:false,finalScore:null,classification:'AMOUNT_RECONCILED_AUTHORIZATION_PENDING',reconciliation:{verifiedDistinct:34,recoveredPending:2,sourceDigest:'a'.repeat(64)},stopReason:'CHECKPOINTED'};
const candidates=[{runId:39729408869,state}],artifactName='liquidity-history-39729408870';
test('valid offline successor remains a candidate, not promoted',async()=>{
 const result=await execute({pool,candidates,artifactName,cycle:async({maxRequests})=>({requests:maxRequests,state:{...state,seen:[a,b]}})});
 assert.equal(result.checkpointEligible,true);assert.equal(result.requests,60);assert.equal(result.liveExecutionEnabled,false);
});
test('failed cycle pauses and preserves original source',async()=>{
 const result=await execute({pool,candidates,artifactName,cycle:async()=>{throw Error('SYNTHETIC_RPC_FAILURE');}});
 assert.equal(result.status,'PAUSE_CYCLE_FAILURE');assert.equal(result.sourceRunId,39729408869);assert.equal(result.checkpointEligible,false);
});
test('over-budget, unsafe and partial results fail closed',async()=>{
 await assert.rejects(execute({pool,candidates,artifactName,cycle:async()=>({requests:61,state})}),/ACCOUNTING/);
 await assert.rejects(execute({pool,candidates,artifactName,cycle:async()=>({requests:1,state:{...state,finalScore:10}})}));
 const result=await execute({pool,candidates,artifactName:'liquidity-history-partial-39729408870',cycle:async()=>({requests:2,state:{...state,pendingSignatures:[b]}})});
 assert.equal(result.checkpointEligible,false);
});
test('exhaustion never invokes cycle',async()=>{
 let called=false;
 const done={...state,complete:true,historyCoverageVerified:true};
 const result=await execute({pool,candidates:[{runId:39729408869,state:done}],artifactName,cycle:async()=>{called=true;}});
 assert.equal(called,false);assert.equal(result.requests,0);
});
