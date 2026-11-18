// Classification-oriented offline review, not an authorization decoder.
export function assessLiquidityProofReadiness(checkpoint, expectedPool) {
  if (!checkpoint || typeof checkpoint !== 'object' || checkpoint.schemaVersion !== 1 ||
      checkpoint.pool !== expectedPool ||
      checkpoint.classification !== 'AMOUNT_RECONCILED_AUTHORIZATION_PENDING' ||
      !Array.isArray(checkpoint.events) || !Array.isArray(checkpoint.seen)) {
    throw Error('INVALID_LIQUIDITY_CHECKPOINT');
  }
  const candidates = checkpoint.events.filter(event => event?.eligibleForAuthorizationReview === true);
  return Object.freeze({
    action: 'REQUIRES_TARGETED_AUTHORIZATION_PROOF',
    reason: 'ACCOUNT_ROLES_AND_SIGNER_AUTHORIZATION_NOT_INDEPENDENTLY_VERIFIED',
    candidates: candidates.length,
    stopAuthorized: false,
    scorePromotable: false
  });
}
