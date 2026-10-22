import test from 'node:test';
import assert from 'node:assert/strict';
import {selectLiquidityContinuationCheckpoint as select} from '../lib/liquidityAutomaticCheckpointSelector.mjs';
const pool='6e3jZLtf4tQbWZm3f7A66jF8tfZn6MRQVrbDFgcNWarA';
const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const sig=n=>{let x=n+1,s='';while(x>0){s=alphabet[x%alphabet.length]+s;x=Math.floor(x/alphabet.length);}return s.padStart(64,'1');};
const state=(count=60)=>({
 schemaVersion:1,pool,before:sig(999),seen:Array.from({length:count},(_,i)=>sig(i+1)),events:[],pages:2,complete:false,
 classification:'AMOUNT_RECONCILED_AUTHORIZATION_PENDING',pendingSignatures:[],pendingSignatureCount:0,unresolvedReasons:{},
 errors:[],requestCount:60,stopReason:'CHECKPOINTED',finalScore:null,authorizationVerified:false,withdrawalVerified:false,historyCoverageVerified:false,
 reconciliation:{reconciliationStatus:'PENDING_SIGNATURES_RECONCILED_HISTORY_UNVERIFIED',originalPendingSignatureCount:2,originalStopReason:'RETRIEVAL_INCOMPLETE',sourceDigest:'a'.repeat(64),replayDigest:'b'.repeat(64),originalSeen:32,recoveredPending:2,verifiedDistinct:34,candidateCount:0,historyExhausted:false}
});
const item=(runId,s)=>({runId,state:s});
test('validated 60-signature baseline is selected without promotion',()=>{
 const x=select([item(39594375245,state())],pool);
 assert.equal(x.runId,39594375245);assert.equal(x.state.seen.length,60);assert.equal(x.state.finalScore,null);assert.equal(x.state.authorizationVerified,false);
});
test('newer invalid checkpoint blocks automatic continuation',()=>{
 const newer={...state(61),authorizationVerified:true};
 assert.throws(()=>select([item(39594375245,state()),item(39596576585,newer)],pool),/NEWER_CHECKPOINT_INVALID/);
});
test('signature, request and source lineage regressions are rejected',()=>{
 const base=state();
 const missing=state(59);missing.seen=base.seen.slice(1);
 const requests=state(61);requests.requestCount=59;
 const drift=state(61);drift.reconciliation={...drift.reconciliation,sourceDigest:'c'.repeat(64)};
 for(const changed of [missing,requests,drift])assert.throws(()=>select([item(100,base),item(101,changed)],pool));
});
test('diagnostics and partial evidence cannot be selected',()=>{
 const base=state();
 for(const unsafe of [{kind:'LIQUIDITY_HISTORY_FAILURE_DIAGNOSTIC',completedSignatures:base.seen},{...base,pendingSignatures:[sig(888)],pendingSignatureCount:1,unresolvedReasons:{[sig(888)]:'RPC_TRANSACTION_UNAVAILABLE'}},{...base,finalScore:1},{...base,historyCoverageVerified:true}]){
  assert.throws(()=>select([item(100,base),item(101,unsafe)],pool),/NEWER_CHECKPOINT_INVALID/);
 }
});
