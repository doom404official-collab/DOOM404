// Compare verified token-vault raw balances only; this does not prove swaps, withdrawals, or USD liquidity.
export function comparePoolVaultSnapshots(previous=[],current=[]) {
 const prior=new Map(previous.filter(p=>p?.pairAddress).map(p=>[p.pairAddress,p]));
 const results=[];
 for(const pool of current) {
  const old=prior.get(pool?.pairAddress);
  const before=old?.vaultAccountEvidence,after=pool?.vaultAccountEvidence;
  const valid=v=>v?.authorityAssessment?.authorityEvidenceComplete===true && v?.base?.verified===true && v?.quote?.verified===true;
  if(!valid(before)||!valid(after))continue;
  const delta=(a,b)=>(BigInt(b)-BigInt(a)).toString();
  results.push({pairAddress:pool.pairAddress,
   baseRawDelta:delta(before.base.rawAmount,after.base.rawAmount),
   quoteRawDelta:delta(before.quote.rawAmount,after.quote.rawAmount),
   withdrawalConfirmed:false,
   executableLiquidityVerified:false});
 }
 return {comparedPools:results.length,pools:results,liquidityStabilityVerified:false,warning:"Raw balance changes may reflect swaps, deposits, withdrawals, fees, or other activity."};
}
