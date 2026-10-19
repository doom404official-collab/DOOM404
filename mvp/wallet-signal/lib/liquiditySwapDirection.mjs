export function assessSwapReserveDirection(operations=[],balanceEvidence) {
 const vaults=balanceEvidence?.vaults??[];
 if(!balanceEvidence?.allVaultBalancesObserved||vaults.length!==2||vaults.some(v=>v.rawDelta===null))return {status:"insufficient_evidence",directionConsistent:false,withdrawalConfirmed:false};
 const base=BigInt(vaults[0].rawDelta),quote=BigInt(vaults[1].rawDelta);
 const matched=operations.filter(o=>o.poolMatched===true);
 const types=[...new Set(matched.map(o=>o.operation))];
 if(types.length!==1)return {status:"ambiguous_operations",directionConsistent:false,withdrawalConfirmed:false};
 const operation=types[0];
 const consistent=(operation==="buy"||operation==="buy_exact_quote_in")?base<0n&&quote>0n:operation==="sell"?base>0n&&quote<0n:false;
 return {status:consistent?"direction_consistent":"direction_mismatch",operation,baseRawDelta:base.toString(),quoteRawDelta:quote.toString(),directionConsistent:consistent,withdrawalConfirmed:false,liquiditySafetyVerified:false};
}
