import {planLiquidityTargetedProof} from './liquidityTargetedProofPlan.mjs';
// Offline scheduling plan only. Does not perform RPC or authorize a worker.
export function planLiquidityProofBatch(checkpoint, pool, maxTransactions=10) {
  if (!Number.isSafeInteger(maxTransactions) || maxTransactions < 1 || maxTransactions > 10) {
    throw Error('INVALID_TARGETED_PROOF_BATCH_LIMIT');
  }
  const plan=planLiquidityTargetedProof(checkpoint,pool);
  if (plan.action!=='TARGETED_PROOF_REVIEW') {
    return Object.freeze({action:'PAUSE_INVALID_CANDIDATES',targets:Object.freeze([]),
      remaining:plan.distinctTransactions,liveRpcAuthorized:false});
  }
  return Object.freeze({action:plan.distinctTransactions?'REVIEW_OFFLINE_BATCH':'NO_TARGETED_CANDIDATES',
    targets:Object.freeze(plan.targets.slice(0,maxTransactions)),
    remaining:Math.max(0,plan.distinctTransactions-maxTransactions),
    liveRpcAuthorized:false});
}
