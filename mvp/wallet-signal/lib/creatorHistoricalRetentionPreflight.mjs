import {createHash} from 'node:crypto';
import {inspectCreatorArchiveAccountResponse} from './creatorArchiveAccountDiagnostic.mjs';

const slot=442809233;
const address='4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf';
const digest='9aa57beb2b897cc175a536f170ddb25c0c8bed8ed6620c7087d8a7fb834f7d30';

/** Pure offline preflight. Does not upload, decode recipients or authorize scoring. */
export function prepareHistoricalGlobalRetention(capture){
 if(capture?.capture?.accountAddress!==address||capture?.capture?.requestedSlot!==slot||
    capture?.capture?.method!=='getAccountInfo'||capture?.result?.context?.slot!==slot)
  return {status:'REJECTED',reason:'CAPTURE_PROVENANCE_MISMATCH'};
 const diagnosis=inspectCreatorArchiveAccountResponse({data:{result:capture.result},slot});
 if(!diagnosis.accountHeaderMatches||diagnosis.accountDataBytes!==1045||diagnosis.accountDataSha256!==digest)
  return {status:'REJECTED',reason:'ACCOUNT_EVIDENCE_MISMATCH'};
 const payload=Buffer.from(JSON.stringify(capture));
 if(payload.length>1048576)return {status:'REJECTED',reason:'PAYLOAD_TOO_LARGE'};
 return {status:'READY_FOR_RESTRICTED_REVIEW',payload,objectKey:`global/${slot}/${address}/${digest}.json`,
  payloadSha256:createHash('sha256').update(payload).digest('hex'),eligibleForLivePromotion:false};
}
