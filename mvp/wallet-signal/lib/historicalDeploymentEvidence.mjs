/** Evidence-first historical role classification. Never infer beneficial owner,
 * launchpad-designated creator, or fee recipient from a deployment signer.
 */
export function classifyHistoricalDeploymentEvidence(findings, indexedCreator) {
  if (!Array.isArray(findings) || findings.length !== 1) return {
    status: "UNRESOLVED", deploymentSigner: null, creatorVerified: false
  };
  const f=findings[0];
  const strong=f.kind==="legacy_create_three_strings" &&
    f.mintMatched===true && f.accountCount===14 &&
    f.exactlyThreeStrings===true && f.messageSigner===true &&
    f.userAccount===indexedCreator && f.indexedCreatorMatchesUser===true;
  return strong ? {
    status:"DEPLOYMENT_SIGNER_ONCHAIN_MATCH",
    deploymentSigner:f.userAccount,
    indexedCreator,
    launchpadCreator:null,
    creatorVerified:false,
    independentHistoricalRoleReview:false
  } : {status:"UNRESOLVED",deploymentSigner:null,creatorVerified:false};
}
