export function assessOfflineEvidencePreservation({prior,next,artifactName}){
 if(!prior||!next||typeof artifactName!=='string')throw Error('EVIDENCE_INPUT_REQUIRED');
 if(!Array.isArray(prior.seen)||!Array.isArray(next.seen))throw Error('INVALID_EVIDENCE_SIGNATURES');
 if(prior.pool!==next.pool||prior.reconciliation?.sourceDigest!==next.reconciliation?.sourceDigest)throw Error('EVIDENCE_PROVENANCE_DRIFT');
 if(next.seen.length<prior.seen.length||prior.seen.some(s=>!next.seen.includes(s)))throw Error('EVIDENCE_LINEAGE_REGRESSION');
 if(next.authorizationVerified!==false||next.withdrawalVerified!==false||next.finalScore!==null)throw Error('UNAUTHORIZED_EVIDENCE_PROMOTION');
 if(next.complete!==true&&next.historyCoverageVerified!==false)throw Error('UNVERIFIED_HISTORY_COVERAGE');
 if(next.pendingSignatures?.length||next.stopReason==='RETRIEVAL_INCOMPLETE')return {action:'ISOLATE_PARTIAL_NO_PROMOTION',checkpointEligible:false};
 if(!/^liquidity-history-[0-9]+$/.test(artifactName))throw Error('UNTRUSTED_CHECKPOINT_ARTIFACT_NAME');
 return {action:'VALIDATED_SUCCESSOR_CANDIDATE',checkpointEligible:true};
}
