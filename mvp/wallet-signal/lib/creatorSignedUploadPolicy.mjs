import {TEST_OBJECT,TEST_WORKFLOW,TEST_REF} from './creatorEvidenceTestProfile.mjs';
// Pure policy validation only. No signing, network access, secrets, or uploads.
const expectedPath='global/442809233/4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf/9aa57beb2b897cc175a536f170ddb25c0c8bed8ed6620c7087d8a7fb834f7d30.json';
const expectedBranch='refs/heads/feature/creator-history-worker-500';
const expectedWorkflow='creator-global-restricted-capture.yml';
function evaluate(request,{approvedCommit,nowMs=Date.now()}={},path=expectedPath,branch=expectedBranch,workflow=expectedWorkflow){
 const fail=reason=>({authorized:false,reason,eligibleForLivePromotion:false});
 if(!request||!approvedCommit||request.commit!==approvedCommit)return fail('COMMIT_NOT_APPROVED');
 if(request.branch!==branch||request.workflow!==workflow)return fail('WORKFLOW_IDENTITY_MISMATCH');
 if(request.bucket!=='creator-historical-evidence'||request.objectKey!==path)return fail('OBJECT_IDENTITY_MISMATCH');
 if(request.overwrite!==false)return fail('OVERWRITE_FORBIDDEN');
 if(!Number.isSafeInteger(nowMs)||!Number.isSafeInteger(request.expiresAtMs)||request.expiresAtMs<=nowMs||request.expiresAtMs>nowMs+300000)return fail('EXPIRATION_INVALID');
 if(request.singleUse!==true||request.used===true)return fail('REPLAY_PROTECTION_REQUIRED');
 return {authorized:true,status:'POLICY_APPROVED_ONLY',eligibleForLivePromotion:false};
}

export const evaluateCreatorUploadAuthorization=(r,o)=>evaluate(r,o);
export const evaluateCreatorTestUploadAuthorization=(r,o)=>evaluate(r,o,TEST_OBJECT,TEST_REF,TEST_WORKFLOW);
