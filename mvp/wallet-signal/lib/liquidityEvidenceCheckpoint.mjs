import {projectLiquidityScoring} from './liquidityScoringProjection.mjs';
export function validateLiquidityCheckpoint(e) {
 if (!e || typeof e.mint !== "string" || !Array.isArray(e.pools) || !Array.isArray(e.batchErrors)) throw Error("INVALID_LIQUIDITY_CHECKPOINT");
 if(e.schemaVersion===2){
  const scoring=projectLiquidityScoring(e,e.mint);
  if(e.poolInventoryComplete!==true||e.batchErrors.length||e.pools.length!==scoring.coverage.poolAddresses.length||
   new Set(e.pools.map(p=>p?.address)).size!==e.pools.length||e.pools.some(p=>!scoring.coverage.poolAddresses.includes(p?.address)))throw Error('LIQUIDITY_POOL_COVERAGE_MISMATCH');
  return true;
 }
 if(e.schemaVersion!==undefined&&e.schemaVersion!==1)throw Error('LIQUIDITY_CHECKPOINT_UNSUPPORTED');
 if (e.finalScore !== null || e.verifiedDepth !== false || e.lpSecurityVerified !== false) throw Error("UNVERIFIED_LIQUIDITY_SCORE");
 if (!["partial","account_checks_completed"].includes(e.status)) throw Error("INVALID_LIQUIDITY_STATUS");
 return true;
}
