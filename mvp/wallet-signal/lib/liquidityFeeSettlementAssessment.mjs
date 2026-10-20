export function assessFeeSettlement({sweepAccounts,transferEvidence,vaultBalanceEvidence}={}){
 const sweeps=(sweepAccounts?.sweeps??[]).filter(x=>x.poolMatched===true);
 const transfers=transferEvidence?.transfers??[];
 const vaults=vaultBalanceEvidence?.vaults??[];
 const targetVaults=[...new Set(sweeps.map(s=>s.quoteVault).filter(Boolean))];
 const quote=targetVaults.length===1?vaults.find(v=>v.vault===targetVaults[0]):null;
 const matched=sweeps.length>0&&transfers.length===sweeps.length&&sweeps.every(s=>transfers.filter(t=>t.outerInstructionIndex===s.outerInstructionIndex&&t.parentInstructionMatched===true&&t.source===s.quoteVault&&t.destination===s.recipientTokenAccount&&t.operation===s.operation).length===1);
 const valid=transfers.every(t=>/^[0-9]+$/.test(String(t.amountRaw)));
 const total=valid?transfers.reduce((sum,t)=>sum+BigInt(t.amountRaw),0n):null;
 const delta=quote?.status==="observed"&&/^-?[0-9]+$/.test(String(quote.rawDelta))?BigInt(quote.rawDelta):null;
 const reconciled=matched&&valid&&delta!==null&&delta<0n&&total===-delta;
 return {status:reconciled?"AMOUNT_RECONCILED_AUTHORIZATION_PENDING":"INCOMPLETE_SETTLEMENT_EVIDENCE",targetSweepCount:sweeps.length,matchedTransferCount:transfers.length,matchedParentInstructions:matched,totalTransferRaw:total?.toString()??null,quoteVaultRawDelta:delta?.toString()??null,unexplainedRaw:delta!==null&&total!==null?(-delta-total).toString():null,amountReconciled:reconciled,authorizationVerified:false,settlementVerified:false,withdrawalConfirmed:false};
}
