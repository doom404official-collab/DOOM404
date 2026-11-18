import test from 'node:test';
import assert from 'node:assert/strict';
import {planLiquidityHistoryCycle as plan,LQ08_BASELINE_RUN} from '../lib/liquidityAutoWorkerDecision.mjs';
const pool='11111111111111111111111111111111';
const state={schemaVersion:1,pool,before:'1'.repeat(64),seen:['1'.repeat(64)],events:[],pendingSignatures:[],complete:false,historyCoverageVerified:false,authorizationVerified:false,withdrawalVerified:false,finalScore:null,classification:'AMOUNT_RECONCILED_AUTHORIZATION_PENDING',reconciliation:{verifiedDistinct:34,recoveredPending:2},stopReason:'CHECKPOINTED'};
test('bounded planning never executes and pins validated run',()=>{
 assert.deepEqual(plan({runId:LQ08_BASELINE_RUN,state,pool}),{action:'READY_FOR_SEPARATELY_AUTHORIZED_RUN',requests:60,sourceRunId:LQ08_BASELINE_RUN});
 assert.throws(()=>plan({runId:LQ08_BASELINE_RUN-1,state,pool}),/BASELINE/);
});
test('verified exhaustion stops, unresolved pauses',()=>{
 assert.equal(plan({runId:LQ08_BASELINE_RUN,state:{...state,complete:true,historyCoverageVerified:true},pool}).action,'STOP_COMPLETE');
 assert.equal(plan({runId:LQ08_BASELINE_RUN,state:{...state,pendingSignatures:['2'.repeat(64)]},pool}).action,'PAUSE_UNRESOLVED');
});
test('incomplete coverage claims and score promotion rejected',()=>{
 assert.throws(()=>plan({runId:LQ08_BASELINE_RUN,state:{...state,historyCoverageVerified:true},pool}));
 assert.throws(()=>plan({runId:LQ08_BASELINE_RUN,state:{...state,finalScore:20},pool}));
 assert.throws(()=>plan({runId:LQ08_BASELINE_RUN,state:{...state,authorizationVerified:true},pool}));
});
