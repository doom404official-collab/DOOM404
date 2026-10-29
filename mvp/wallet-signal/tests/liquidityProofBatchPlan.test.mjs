import test from 'node:test';
import assert from 'node:assert/strict';
import {planLiquidityProofBatch} from '../lib/liquidityProofBatchPlan.mjs';
const checkpoint=()=>({schemaVersion:1,pool:'pool',
  classification:'AMOUNT_RECONCILED_AUTHORIZATION_PENDING',seen:['a','b'],
  events:['a','b'].map((signature,i)=>({signature,slot:10-i,operation:'set_coin_creator',
    classification:'UNVERIFIED_CANDIDATE',eligibleForAuthorizationReview:true}))});
test('limits offline targeted review to one transaction',()=>{
  const result=planLiquidityProofBatch(checkpoint(),'pool',1);
  assert.equal(result.targets.length,1);
  assert.equal(result.remaining,1);
  assert.equal(result.liveRpcAuthorized,false);
});
test('rejects oversized batch',()=>{
  assert.throws(()=>planLiquidityProofBatch(checkpoint(),'pool',11),
    /INVALID_TARGETED_PROOF_BATCH_LIMIT/);
});
test('invalid candidates prevent all planned review',()=>{
  const f=checkpoint(); f.events[0].signature='not-seen';
  const result=planLiquidityProofBatch(f,'pool');
  assert.equal(result.action,'PAUSE_INVALID_CANDIDATES');
  assert.equal(result.targets.length,0);
});
