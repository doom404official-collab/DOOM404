// Compare compatible token-vault raw balances only; never prove swaps, withdrawals, or USD liquidity.
const raw = value => typeof value === "string" && /^(0|[1-9][0-9]*)$/.test(value);
const nonempty = value => typeof value === "string" && value.length > 0;
function identity(pool) {
 const v=pool?.vaultAccountEvidence, c=pool?.decodedPumpAmmCandidate;
 if (v?.authorityAssessment?.authorityEvidenceComplete !== true || v?.base?.verified !== true || v?.quote?.verified !== true) return null;
 if (![v.base.rawAmount,v.quote.rawAmount].every(raw)) return null;
 const fields=[pool.pairAddress,c?.poolBaseTokenAccount,c?.poolQuoteTokenAccount,v.base.mint,v.quote.mint,v.base.authority,v.quote.authority,v.base.tokenProgram,v.quote.tokenProgram];
 if (!fields.every(nonempty) || v.base.mint!==c?.baseMint || v.quote.mint!==c?.quoteMint || v.base.authority!==pool.pairAddress || v.quote.authority!==pool.pairAddress) return null;
 return JSON.stringify(fields);
}
export function comparePoolVaultSnapshots(previous=[],current=[]) {
 const prior=new Map(), duplicates=new Set();
 for (const p of Array.isArray(previous)?previous:[]) {
  if (prior.has(p?.pairAddress)) duplicates.add(p?.pairAddress);
  prior.set(p?.pairAddress,p);
 }
 const currentCounts=new Map();
 for(const p of Array.isArray(current)?current:[]) currentCounts.set(p?.pairAddress,(currentCounts.get(p?.pairAddress)||0)+1);
 const results=[],rejectedPools=[];
 for(const pool of Array.isArray(current)?current:[]) {
  const old=prior.get(pool?.pairAddress);
  if (!old) continue;
  const beforeIdentity=identity(old), afterIdentity=identity(pool);
  if (duplicates.has(pool?.pairAddress) || currentCounts.get(pool?.pairAddress)!==1 || !beforeIdentity || beforeIdentity!==afterIdentity) {
   rejectedPools.push({pairAddress:pool?.pairAddress??null,reason:"incompatible_or_invalid_vault_snapshot"});
   continue;
  }
  const before=old.vaultAccountEvidence,after=pool.vaultAccountEvidence;
  const delta=(a,b)=>(BigInt(b)-BigInt(a)).toString();
  results.push({pairAddress:pool.pairAddress,
   baseRawDelta:delta(before.base.rawAmount,after.base.rawAmount),
   quoteRawDelta:delta(before.quote.rawAmount,after.quote.rawAmount),
   withdrawalConfirmed:false,
   executableLiquidityVerified:false});
 }
 return {comparedPools:results.length,pools:results,rejectedPools,liquidityStabilityVerified:false,warning:"Raw balance changes may reflect swaps, deposits, withdrawals, fees, or other activity."};
}
