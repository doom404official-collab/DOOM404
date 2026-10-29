import test from 'node:test';
import assert from 'node:assert/strict';
import {triageLiquidityHistoricalEvents} from '../lib/liquidityEventTriage.mjs';
const event = (operation, extra={}) => ({
  operation, transactionExecution:'EXECUTION_SUCCEEDED_AUTHORIZATION_UNVERIFIED',
  ...extra
});
test('fee settlement candidate is not LP withdrawal proof', () => {
  const result=triageLiquidityHistoricalEvents([
    event('collect_coin_creator_fee',{feeSettlementNotLpWithdrawal:true})
  ]);
  assert.equal(result.feeSettlementCandidates,1);
  assert.equal(result.authorizationReviewCandidates,0);
  assert.equal(result.stopAuthorized,false);
  assert.equal(result.scorePromotable,false);
});
test('unknown operation and unsupported fee flag require review', () => {
  const result=triageLiquidityHistoricalEvents([
    event('withdraw'),event('collect_coin_creator_fee',{feeSettlementNotLpWithdrawal:false})
  ]);
  assert.equal(result.authorizationReviewCandidates,2);
});
test('failed, unavailable and malformed records are not silently safe', () => {
  const result=triageLiquidityHistoricalEvents([
    event('withdraw',{transactionExecution:'FAILED_TRANSACTION'}),
    event('withdraw',{transactionExecution:'TRANSACTION_META_UNAVAILABLE'}),null
  ]);
  assert.equal(result.failedOrUnavailable,2);
  assert.equal(result.malformed,1);
  assert.equal(result.stopAuthorized,false);
});
test('empty input does not establish safe outcome', () => {
  const result=triageLiquidityHistoricalEvents([]);
  assert.equal(result.total,0);
  assert.equal(result.scorePromotable,false);
  assert.throws(()=>triageLiquidityHistoricalEvents(null),/EVENT_LIST_REQUIRED/);
});
