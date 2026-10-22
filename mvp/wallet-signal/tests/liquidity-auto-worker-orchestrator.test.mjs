import test from 'node:test';
import assert from 'node:assert/strict';
import {planOfflineLiquidityAutomation as plan} from '../lib/liquidityAutoWorkerOrchestrator.mjs';
const pool='11111111111111111111111111111111';
const state={schemaVersion:1,pool,before:'1'.repeat(64),seen:['1'.repeat(64)],events:[],pendingSignatures:[],complete:false,historyCoverageVerified:false,authorizationVerified:false,withdrawalVerified:false,finalScore:null,classification:'AMOUNT_RECONCILED_AUTHORIZATION_PENDING',reconciliation:{verifiedDistinct:34,recoveredPending:2},stopReason:'CHECKPOINTED'};
test('one cycle, 60 requests, no live activation',()=>{
 const x=plan({pool,candidates:[{runId:39729408869,state}]});
 assert.equal(x.requests,60);assert.equal(x.maxCycles,1);
 assert.equal(x.liveExecutionEnabled,false);assert.equal(x.schedulingEnabled,false);assert.equal(x.checkpointPromotionEnabled,false);
 assert.equal(x.concurrencyGroup,'glitch-liquidity-history-worker');
});
test('reject untrusted source, invalid cycles and unsafe evidence',()=>{
 assert.throws(()=>plan({pool,candidates:[{runId:39729408868,state}]}));
 assert.throws(()=>plan({pool,candidates:[{runId:39729408869,state}],maxCycles:2}));
 assert.throws(()=>plan({pool,candidates:[{runId:39729408869,state:{...state,finalScore:1}}]}));
});
