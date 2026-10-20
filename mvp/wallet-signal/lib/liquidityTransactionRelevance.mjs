export function assessPoolTransactionRelevance(operations=[],vaultEvidence) {
 const matched=operations.filter(o=>o.poolMatched===true);
 const other=operations.filter(o=>o.poolMatched!==true);
 const vaults=vaultEvidence?.vaults??[];
 const observedVaults=vaults.filter(v=>v.status==="observed");
 let status="unresolved";
 if(matched.length>0)status="target_pool_operation";
 else if(other.length>0)status="other_pool_operation";
 else if(observedVaults.length>0)status="target_vault_interaction_without_recognized_operation";
 else status="no_target_pool_operation_evidence";
 return {status,targetPoolOperations:matched.length,otherPoolOperations:other.length,observedTargetVaults:observedVaults.length,attributionVerified:false,withdrawalConfirmed:false};
}
