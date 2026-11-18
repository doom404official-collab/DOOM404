import {createHash} from 'node:crypto';
import {prepareHistoricalGlobalRetention} from './creatorHistoricalRetentionPreflight.mjs';

// Offline-injectable transport. Caller supplies restricted endpoint and fetch.
export async function storeHistoricalGlobal(capture,transport){
 const evidence=prepareHistoricalGlobalRetention(capture);
 if(evidence.status!=='READY_FOR_RESTRICTED_REVIEW')return {status:'REJECTED',reason:evidence.reason};
 if(!transport||typeof transport.upload!=='function'||typeof transport.read!=='function')
  return {status:'REJECTED',reason:'TRANSPORT_REQUIRED'};
 return storePreparedEvidence(evidence,transport);
}

/** Independently testable transport stage. Not a historical authorization decision. */
export async function storePreparedEvidence(evidence,transport){
 if(evidence?.status!=='READY_FOR_RESTRICTED_REVIEW'||!Buffer.isBuffer(evidence.payload)||
    typeof evidence.objectKey!=='string'||!evidence.objectKey.startsWith('global/')||
    createHash('sha256').update(evidence.payload).digest('hex')!==evidence.payloadSha256)
  return {status:'REJECTED',reason:'PREPARED_EVIDENCE_INVALID'};
 if(!transport||typeof transport.upload!=='function'||typeof transport.read!=='function')
  return {status:'REJECTED',reason:'TRANSPORT_REQUIRED'};
 // Snapshot accepted evidence before asynchronous transport can mutate caller data.
 const objectKey=evidence.objectKey,payloadSha256=evidence.payloadSha256;
 const payload=Buffer.from(evidence.payload),payloadLength=payload.length;
 const uploaded=await transport.upload(objectKey,Buffer.from(payload),{overwrite:false});
 if(uploaded!==true)return {status:'REJECTED',reason:'UPLOAD_NOT_CONFIRMED'};
 const returned=await transport.read(objectKey);
 return verifyHistoricalEvidenceReadback({objectKey,payloadSha256,payloadLength},returned);
}

/** Pure retained-byte comparison, also usable after separately authorized readback. */
export function verifyHistoricalEvidenceReadback({objectKey,payloadSha256,payloadLength},returned){
 if(typeof objectKey!=='string'||!Number.isSafeInteger(payloadLength)||payloadLength<1||payloadLength>1048576||typeof payloadSha256!=='string'||!/^[a-f0-9]{64}$/.test(payloadSha256)||!Buffer.isBuffer(returned)||returned.length!==payloadLength||createHash('sha256').update(returned).digest('hex')!==payloadSha256)return {status:'REJECTED',reason:'READBACK_MISMATCH'};
 return {status:'READBACK_VERIFIED',objectKey,payloadSha256,eligibleForLivePromotion:false};
}
