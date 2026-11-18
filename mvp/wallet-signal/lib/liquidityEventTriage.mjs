// Pure offline triage. Does not establish account roles or authorize score changes.
// Fee-settlement operations are not LP withdrawals merely because funds moved.
const FEE_OPERATIONS = new Set([
  'collect_coin_creator_fee', 'transfer_creator_fees_to_pump',
  'transfer_creator_fees_to_pump_v2'
]);
export function triageLiquidityHistoricalEvents(events) {
  if (!Array.isArray(events)) throw Error('EVENT_LIST_REQUIRED');
  const result = {feeSettlementCandidates:0, authorizationReviewCandidates:0,
    failedOrUnavailable:0, malformed:0, total:events.length};
  for (const event of events) {
    if (!event || typeof event !== 'object' ||
        typeof event.operation !== 'string' ||
        typeof event.transactionExecution !== 'string') {
      result.malformed++;
    } else if (event.transactionExecution !== 'EXECUTION_SUCCEEDED_AUTHORIZATION_UNVERIFIED') {
      result.failedOrUnavailable++;
    } else if (FEE_OPERATIONS.has(event.operation) && event.feeSettlementNotLpWithdrawal === true) {
      result.feeSettlementCandidates++;
    } else {
      result.authorizationReviewCandidates++;
    }
  }
  return Object.freeze({...result, stopAuthorized:false, scorePromotable:false});
}
