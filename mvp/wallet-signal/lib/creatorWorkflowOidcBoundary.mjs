// Offline-only authorization boundary. Caller must supply an independently
// verified OIDC identity; this module NEVER decodes an unverified JWT.
const repository='doom404official-collab/DOOM404';
const branch='refs/heads/feature/creator-history-worker-500';
const workflow='creator-global-restricted-capture.yml';
export async function verifyCreatorWorkflowIdentity(token,{verifyOidc,approvedSha}={}){
 const fail=reason=>({verified:false,reason});
 if(typeof verifyOidc!=='function'||typeof approvedSha!=='string'||!/^[0-9a-f]{40}$/.test(approvedSha))return fail('TRUST_CONFIG_MISSING');
 let claims;
 try{claims=await verifyOidc(token);}catch{return fail('OIDC_VERIFICATION_FAILED');}
 if(!claims||claims.iss!=='https://token.actions.githubusercontent.com'||claims.aud!=='doom404-creator-evidence-issuer')return fail('OIDC_ISSUER_OR_AUDIENCE_MISMATCH');
 if(claims.repository!==repository||claims.ref!==branch||claims.sha!==approvedSha)return fail('WORKFLOW_SOURCE_MISMATCH');
 if(typeof claims.workflow_ref!=='string'||!claims.workflow_ref.startsWith(repository+'/.github/workflows/'+workflow+'@'+branch))return fail('WORKFLOW_IDENTITY_MISMATCH');
 if(typeof claims.run_id!=='string'||!/^[0-9]+$/.test(claims.run_id)||typeof claims.jti!=='string'||claims.jti.length<12)return fail('OIDC_REPLAY_ID_MISSING');
 return {verified:true,status:'VERIFIED_CLAIMS_ONLY',commit:claims.sha,runId:claims.run_id,replayId:claims.jti,eligibleForLivePromotion:false};
}
