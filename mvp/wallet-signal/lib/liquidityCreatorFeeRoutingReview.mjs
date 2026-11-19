export function reviewCreatorFeeRouting({coinCreator,feeRecipient,creatorUpdateEvidence,sharingConfigEvidence,claimEvidence}={}){
 const addressesDiffer=Boolean(coinCreator&&feeRecipient&&coinCreator!==feeRecipient);
 const sharingVerified=sharingConfigEvidence?.accountVerified===true&&sharingConfigEvidence?.recipientAuthorized===true&&sharingConfigEvidence?.historicalApplicabilityVerified===true;
 const claimVerified=claimEvidence?.instructionVerified===true&&claimEvidence?.recipientLinked===true&&claimEvidence?.historicalApplicabilityVerified===true;
 const updateVerified=creatorUpdateEvidence?.creatorChangeVerified===true&&creatorUpdateEvidence?.historicalApplicabilityVerified===true;
 return {status:!coinCreator||!feeRecipient?"INSUFFICIENT_EVIDENCE":!addressesDiffer?"DIRECT_CREATOR_MATCH":sharingVerified||claimVerified||updateVerified?"ROUTING_EVIDENCE_CANDIDATE":"RECIPIENT_MISMATCH_UNRESOLVED",addressesDiffer,sharingVerified,claimVerified,updateVerified,authorizationVerified:false,settlementVerified:false,withdrawalConfirmed:false,requiredEvidence:["Verified historical sharing_config account and beneficiary rules","Creator update transaction and instruction ordering","Claim or transfer route linking recipient to authorized fee beneficiary","Protocol instruction-level recipient eligibility"]};
}
