import {assessLiquidityScoreStop} from './liquidityScoreStopDecision.mjs';
// Offline adapter for the existing historical decoder. Its candidate events do not
// independently establish signer authorization, account roles, or recipient attribution.
export function assessLiquidityCheckpointForEarlyStop(checkpoint, expectedPool) {
  if (!checkpoint || typeof checkpoint !== 'object' || Array.isArray(checkpoint) ||
      checkpoint.schemaVersion !== 1 || checkpoint.pool !== expectedPool ||
      !Array.isArray(checkpoint.events) || !Array.isArray(checkpoint.seen) ||
      checkpoint.classification !== 'AMOUNT_RECONCILED_AUTHORIZATION_PENDING') {
    throw Error('INVALID_LIQUIDITY_CHECKPOINT');
  }
  if (checkpoint.events.some(event => event?.authorizationVerified === true ||
      event?.accountRolesVerified === true || event?.signerAuthorizationVerified === true)) {
    throw Error('UNSUPPORTED_HISTORICAL_PROOF_PROMOTION');
  }
  const result = assessLiquidityScoreStop({
    classification: checkpoint.classification,
    provenanceVerified: false
  });
  return {...result, reason: 'HISTORICAL_DECODER_LACKS_TRUSTED_AUTHORIZATION_PROOF',
    historicalEvents: checkpoint.events.length};
}
