import test from 'node:test';
import assert from 'node:assert/strict';
import {assessLiquidityProofReadiness} from '../lib/liquidityProofReadiness.mjs';
const checkpoint=()=>({schemaVersion:1,pool:'pool',
  classification:'AMOUNT_RECONCILED_AUTHORIZATION_PENDING',
  seen:['sig'],events:[{eligibleForAuthorizationReview:true}]});
test('reports targeted proof need instead of authorizing score promotion',()=>{
  const result=assessLiquidityProofReadiness(checkpoint(),'pool');
  assert.equal(result.candidates,1);
  assert.equal(result.stopAuthorized,false);
  assert.equal(result.scorePromotable,false);
});
test('rejects wrong pool',()=>{
  assert.throws(()=>assessLiquidityProofReadiness(checkpoint(),'wrong'),
    /INVALID_LIQUIDITY_CHECKPOINT/);
});
