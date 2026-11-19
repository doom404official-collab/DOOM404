export function diagnoseSwapAmbiguity(operations=[],vaultEvidence) {
 const matched=operations.filter(o=>o.poolMatched===true);
 const types=[...new Set(matched.map(o=>o.operation))];
 const unmatched=operations.filter(o=>o.poolMatched!==true).length;
 const reasons=[];
 if(!vaultEvidence?.allVaultBalancesObserved)reasons.push("INCOMPLETE_VAULT_BALANCES");
 if(matched.length===0)reasons.push("NO_POOL_MATCHED_OPERATION");
 if(types.length>1)reasons.push("MULTIPLE_OPERATION_TYPES");
 if(matched.length>1)reasons.push("MULTIPLE_POOL_OPERATIONS");
 if(unmatched)reasons.push("OTHER_POOL_OPERATIONS_PRESENT");
 return {reasons,matchedOperations:matched.length,unmatchedOperations:unmatched,distinctMatchedTypes:types,attributionComplete:false,withdrawalConfirmed:false};
}
