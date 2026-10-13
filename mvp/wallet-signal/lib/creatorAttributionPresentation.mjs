/** Customer-facing labels describe evidence, not a claim of human identity.
 * Keep independent review as a separate field.
 */
export function describeCreatorAttribution(result){
 const status=result?.status;
 if(status==="VERIFIED"||status==="ONCHAIN_MATCH_PENDING_INDEPENDENT_REVIEW"){
  if(!result?.creator||!result?.evidence?.length)return {label:"Creator evidence incomplete",level:"incomplete",detail:"Stored creator evidence could not be reconciled."};
  return {label:"On-chain creator confirmed",level:"onchain",
   detail:status==="VERIFIED"?"Creation instruction verified; independent review completed.":"Creation instruction verified; independent review pending.",
   independentReview:status==="VERIFIED"?"completed":"pending"};
 }
 if(status==="DEPLOYMENT_SIGNER_ONCHAIN_MATCH")
  return {label:"Deployment wallet confirmed",level:"signer",
   detail:"Creation signer matches indexed wallet; historical launchpad creator role not established.",
   independentReview:"pending"};
 if(status==="INDEXED_UNVERIFIED"&&result?.creator)
  return {label:"Creator identified by provider",level:"provider",
   detail:"Indexed attribution available; creation instruction not yet verified.",
   independentReview:"not_completed"};
 if(status==="CONFLICT")
  return {label:"Conflicting creator attribution",level:"conflict",detail:"Sources disagree; investigate before relying on this wallet."};
 return {label:"Creator not identified",level:"unknown",detail:"Available evidence does not establish a creator wallet."};
}
