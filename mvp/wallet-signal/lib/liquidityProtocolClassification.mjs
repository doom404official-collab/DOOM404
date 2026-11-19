// Program ownership is a classification hint, never proof of reserves or LP safety.
export const KNOWN_POOL_PROGRAMS = Object.freeze({
 "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA": "pump_amm"
});
export function classifyPoolProgram(pool) {
 const owner = pool?.accountOwnerProgram;
 const protocol = pool?.accountExists === true && typeof owner === "string"
  ? KNOWN_POOL_PROGRAMS[owner] ?? null : null;
 return {
  pairAddress:pool?.pairAddress ?? null,
  observedOwnerProgram:owner ?? null,
  protocolCandidate:protocol,
  classification:"owner_program_hint_only",
  protocolVerified:false,
  reservesVerified:false,
  lpLocksVerified:false,
  lpBurnsVerified:false,
  withdrawalRightsVerified:false
 };
}
