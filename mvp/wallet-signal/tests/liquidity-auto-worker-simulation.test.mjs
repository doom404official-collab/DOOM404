import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateLiquidityHistoryCycles as simulate} from '../lib/liquidityAutoWorkerSimulation.mjs';
const pool='11111111111111111111111111111111',a='1'.repeat(64),b='2'.repeat(64),c='3'.repeat(64);
const state=(seen=[a],complete=false)=>({schemaVersion:1,pool,before:a,seen,events:[],pendingSignatures:[],complete,historyCoverageVerified:complete,authorizationVerified:false,withdrawalVerified:false,finalScore:null,classification:'AMOUNT_RECONCILED_AUTHORIZATION_PENDING',reconciliation:{verifiedDistinct:34,recoveredPending:2,sourceDigest:'a'.repeat(64)},stopReason:complete?'HISTORY_EXHAUSTED':'CHECKPOINTED'});
const baseline={runId:39729408869,state:state()};
test('multiple validated offline successors then stop on proven exhaustion',()=>{
 const result=simulate({pool,baseline,successors:[{runId:39729408870,state:state([a,b]),artifactName:'liquidity-history-39729408870'},{runId:39729408871,state:state([a,b,c],true),artifactName:'liquidity-history-39729408871'}]});
 assert.equal(result.finalRunId,39729408871);
 assert.equal(result.steps.at(-1).action,'STOP_COMPLETE');
 assert.ok(result.steps.every(x=>x.requests===0));assert.equal(result.liveExecutionEnabled,false);
});
test('partial evidence never replaces authoritative checkpoint',()=>{
 const result=simulate({pool,baseline,successors:[{runId:39729408870,state:{...state([a,b]),pendingSignatures:[c]},artifactName:'liquidity-history-partial-39729408870'}]});
 assert.equal(result.finalRunId,baseline.runId);assert.equal(result.steps[0].action,'PAUSE_PARTIAL_EVIDENCE');
});
test('reject invalid lineage, unauthorized scoring and excessive cycles',()=>{
 assert.throws(()=>simulate({pool,baseline,successors:[{runId:39729408870,state:state([b]),artifactName:'liquidity-history-39729408870'}]}));
 assert.throws(()=>simulate({pool,baseline,successors:[{runId:39729408870,state:{...state([a,b]),finalScore:10},artifactName:'liquidity-history-39729408870'}]}));
 assert.throws(()=>simulate({pool,baseline,maxCycles:11}));
});
