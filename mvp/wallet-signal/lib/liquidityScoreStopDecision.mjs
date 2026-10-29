// Pure offline sufficiency assessment. Not wired to any historical worker or score engine.
// These are assertions supplied by the caller, NOT independent proof validation.
// A STOP_SCORE_RESOLVED decision is advisory until a trusted evidence adapter exists.
export const LIQUIDITY_STOP_QUESTIONS = Object.freeze([
  'poolIdentity', 'amountReconciliation', 'accountRoles',
  'signerAuthorization', 'recipientAttribution', 'scoreImpact'
]);

export function assessLiquidityScoreStop(evidence) {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    throw new Error('LIQUIDITY_EVIDENCE_REQUIRED');
  }
  if (evidence.classification !== 'AMOUNT_RECONCILED_AUTHORIZATION_PENDING') {
    throw new Error('LIQUIDITY_CLASSIFICATION_MISMATCH');
  }
  if (evidence.provenanceVerified !== true) {
    return { action: 'PAUSE_UNRESOLVED', reason: 'PROVENANCE_NOT_VERIFIED', requests: 0 };
  }
  const missing = LIQUIDITY_STOP_QUESTIONS.filter(key => evidence[key] !== true);
  if (missing.length) {
    return { action: 'CONTINUE_TARGETED', reason: 'SCORING_QUESTIONS_OPEN', missing, requests: 0 };
  }
  return { action: 'STOP_CANDIDATE_REQUIRES_TRUSTED_PROOF', reason: 'ASSERTIONS_COMPLETE_PROOF_NOT_INDEPENDENTLY_VALIDATED', requests: 0 };
}
