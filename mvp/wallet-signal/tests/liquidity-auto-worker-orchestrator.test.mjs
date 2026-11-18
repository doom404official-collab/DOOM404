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
 assert.throws(()=>plan({pool,candidates:[{runId:39729408869,state},{runId:39729408870,state:{...state,authorizationVerified:true}}]}),/NEWER_CHECKPOINT_INVALID/);
 assert.throws(()=>plan({pool,candidates:[{runId:39729408869,state},{runId:39729408870,state:{...state,seen:[]}}]}),/CHECKPOINT_LINEAGE_REGRESSION/);
});

test('verified exhaustion stops without requesting RPC',()=>{
 const complete={...state,complete:true,historyCoverageVerified:true,pendingSignatures:[],stopReason:'HISTORY_EXHAUSTED'};
 const x=plan({pool,candidates:[{runId:39729408869,state:complete}]});
 assert.equal(x.action,'STOP_COMPLETE');assert.equal(x.requests,0);assert.equal(x.checkpointPromotionEnabled,false);
});
test('unresolved newest checkpoint cannot silently fall back to older source',()=>{
 const pending={...state,pendingSignatures:['2'.repeat(64)]};
 assert.throws(()=>plan({pool,candidates:[{runId:39729408869,state},{runId:39729408870,state:pending}]}),/NEWER_CHECKPOINT_INVALID/);
});
test('evidence error pauses with zero requests',()=>{
 const paused={...state,stopReason:'RETRIEVAL_INCOMPLETE'};
 const x=plan({pool,candidates:[{runId:39729408869,state:paused}]});
 assert.equal(x.action,'PAUSE_MANUAL_REVIEW');assert.equal(x.requests,0);
});
