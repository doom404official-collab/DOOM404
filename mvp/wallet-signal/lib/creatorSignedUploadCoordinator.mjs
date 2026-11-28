// Pure authorization coordinator. Inject a durable atomic claim store and token issuer.
// Does not authenticate GitHub callers or sign real tokens by itself.
import {evaluateCreatorUploadAuthorization,evaluateCreatorTestUploadAuthorization} from './creatorSignedUploadPolicy.mjs';
async function authorize(request,{approvedCommit,nowMs,claimOnce,issueSignedUpload}={},evaluate=evaluateCreatorUploadAuthorization){
 const policy=evaluate(request,{approvedCommit,nowMs});
 if(!policy.authorized)return policy;
 if(typeof claimOnce!=='function'||typeof issueSignedUpload!=='function')
  return {authorized:false,reason:'ISSUER_DEPENDENCIES_UNAVAILABLE',eligibleForLivePromotion:false};
 const claimId=[request.commit,request.bucket,request.objectKey].join(':');
 const claimed=await claimOnce(claimId,request.expiresAtMs);
 if(claimed!==true)return {authorized:false,reason:'REPLAY_OR_CLAIM_FAILED',eligibleForLivePromotion:false};
 try{
  const issued=await issueSignedUpload({bucket:request.bucket,objectKey:request.objectKey,overwrite:false});
  if(issued!==true)return {authorized:false,reason:'SIGNED_ISSUANCE_UNCONFIRMED',eligibleForLivePromotion:false};
  return {authorized:true,status:'SIGNED_ISSUANCE_CONFIRMED',eligibleForLivePromotion:false};
 }catch{
  return {authorized:false,reason:'SIGNED_ISSUANCE_FAILED',eligibleForLivePromotion:false};
 }
}

export const authorizeCreatorEvidenceUpload=(r,o)=>authorize(r,o);
export const authorizeCreatorTestEvidenceUpload=(r,o)=>authorize(r,o,evaluateCreatorTestUploadAuthorization);
