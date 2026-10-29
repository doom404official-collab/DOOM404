// Pure offline planner: target only distinct observed transaction signatures.
// Does not assert account-role authorization or alter checkpoint state.
import {validateHistoryCheckpoint} from './liquidityHistoricalDecoder.mjs';

export function planLiquidityTargetedProof(checkpoint, pool) {
  validateHistoryCheckpoint(checkpoint, pool);
  const signatures = new Set(checkpoint.seen);
  const targets = new Map();
  let invalidCandidates = 0;
  for (const event of checkpoint.events) {
    if (event?.eligibleForAuthorizationReview !== true) continue;
    if (typeof event.signature !== 'string' || !signatures.has(event.signature) ||
        !Number.isSafeInteger(event.slot) || event.slot < 0 ||
        event.classification !== 'UNVERIFIED_CANDIDATE') {
      invalidCandidates++;
      continue;
    }
    const key = event.signature;
    const prior = targets.get(key);
    if (prior && prior.slot !== event.slot) {
      invalidCandidates++;
      targets.delete(key);
      continue;
    }
    if (!prior) targets.set(key, {signature:key, slot:event.slot, operations:[]});
    if (targets.has(key) && typeof event.operation === 'string' &&
        !targets.get(key).operations.includes(event.operation)) {
      targets.get(key).operations.push(event.operation);
    }
  }
  const work = [...targets.values()].map(item => Object.freeze({
    signature:item.signature, slot:item.slot,
    operations:Object.freeze([...item.operations])
  }));
  return Object.freeze({
    action: invalidCandidates ? 'PAUSE_INVALID_CANDIDATES' : 'TARGETED_PROOF_REVIEW',
    targets:Object.freeze(work),
    invalidCandidates,
    distinctTransactions:work.length,
    historicalEvents:checkpoint.events.length,
    liveRpcAuthorized:false,
    scorePromotable:false
  });
}
