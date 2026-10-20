export function validateLiquidityCheckpoint(e) {
 if (!e || typeof e.mint !== "string" || !Array.isArray(e.pools) || !Array.isArray(e.batchErrors)) throw Error("INVALID_LIQUIDITY_CHECKPOINT");
 if (e.finalScore !== null || e.verifiedDepth !== false || e.lpSecurityVerified !== false) throw Error("UNVERIFIED_LIQUIDITY_SCORE");
 if (!["partial","account_checks_completed"].includes(e.status)) throw Error("INVALID_LIQUIDITY_STATUS");
 return true;
}
