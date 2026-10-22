import {createHash} from 'node:crypto';
import {prepareHistoricalGlobalRetention} from './creatorHistoricalRetentionPreflight.mjs';

// Offline-injectable transport. Caller supplies restricted endpoint and fetch.
export async function storeHistoricalGlobal(capture,transport){
 const evidence=prepareHistoricalGlobalRetention(capture);
 if(evidence.status!=='READY_FOR_RESTRICTED_REVIEW')return {status:'REJECTED',reason:evidence.reason};
 if(!transport||typeof transport.upload!=='function'||typeof transport.read!=='function')
  return {status:'REJECTED',reason:'TRANSPORT_REQUIRED'};
 const uploaded=await transport.upload(evidence.objectKey,evidence.payload,{overwrite:false});
 if(uploaded!==true)return {status:'REJECTED',reason:'UPLOAD_NOT_CONFIRMED'};
 const returned=await transport.read(evidence.objectKey);
 if(!Buffer.isBuffer(returned)||returned.length!==evidence.payload.length||
 createHash('sha256').update(returned).digest('hex')!==evidence.payloadSha256)
  return {status:'REJECTED',reason:'READBACK_MISMATCH'};
 return {status:'READBACK_VERIFIED',objectKey:evidence.objectKey,payloadSha256:evidence.payloadSha256,eligibleForLivePromotion:false};
}
