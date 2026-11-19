export function assessPumpAmmVaultAuthority(poolAddress, candidate, vaultEvidence) {
 const base=vaultEvidence?.base;
 const quote=vaultEvidence?.quote;
 const mintMatched=Boolean(candidate?.baseMint && candidate?.quoteMint && base?.mint===candidate.baseMint && quote?.mint===candidate.quoteMint);
 const bothVaultsValidated=base?.verified===true && quote?.verified===true;
 const bothAuthoritiesMatch=Boolean(poolAddress && base?.authority===poolAddress && quote?.authority===poolAddress);
 return {
  vaultMintMatched:mintMatched,
  vaultAccountsValidated:bothVaultsValidated,
  vaultAuthoritiesMatchPool:bothAuthoritiesMatch,
  authorityEvidenceComplete:mintMatched && bothVaultsValidated && bothAuthoritiesMatch,
  poolProgramAuthorityVerified:false,
  lpSecurityVerified:false,
  executableLiquidityVerified:false
 };
}
