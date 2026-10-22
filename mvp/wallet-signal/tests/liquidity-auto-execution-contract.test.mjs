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

test('awaited caller mutation cannot rewrite validated provenance',async()=>{
 const input=[{runId:39729408869,state:structuredClone(state)}];
 await assert.rejects(execute({pool,candidates:input,artifactName,cycle:async({source})=>{
  await Promise.resolve();
  input[0].state.reconciliation.sourceDigest='b'.repeat(64);
  return {requests:1,state:{...source,seen:[a,b],reconciliation:{...source.reconciliation,sourceDigest:'b'.repeat(64)}}};
 }}),/EVIDENCE_PROVENANCE_DRIFT/);
});
test('awaited mutation preserves original source identity and valid successor',async()=>{
 const input=[{runId:39729408869,state:structuredClone(state)}];
 const result=await execute({pool,candidates:input,artifactName,cycle:async({source})=>{
  await Promise.resolve();
  input[0].runId=1;input[0].state.seen.push(b);
  return {requests:1,state:{...source,seen:[a,b]}};
 }});
 assert.equal(result.sourceRunId,39729408869);assert.equal(result.checkpointEligible,true);
});
test('failed callback retains source identity even when caller mutates it',async()=>{
 const input=[{runId:39729408869,state:structuredClone(state)}];
 const result=await execute({pool,candidates:input,artifactName,cycle:async()=>{
  await Promise.resolve();input[0].runId=1;throw Error('SYNTHETIC_FAILURE');
 }});
 assert.equal(result.sourceRunId,39729408869);assert.equal(result.status,'PAUSE_CYCLE_FAILURE');
});
