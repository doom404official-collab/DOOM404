import {createHash,randomBytes} from 'node:crypto';
import {verifyCreatorGithubOidc,validateCreatorOidcManifest,screenCreatorGithubToken} from './creatorEvidenceOidc.mjs';
import {authorizeCreatorEvidenceUpload} from './creatorSignedUploadCoordinator.mjs';
import {verifyHistoricalEvidenceReadback} from './creatorHistoricalPrivateRetention.mjs';
import {prepareHistoricalGlobalRetention} from './creatorHistoricalRetentionPreflight.mjs';
import {createCreatorExecutionBudget,assertCreatorSignal} from './creatorExecutionBudget.mjs';
const bucket='creator-historical-evidence';
const objectKey='global/442809233/4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf/9aa57beb2b897cc175a536f170ddb25c0c8bed8ed6620c7087d8a7fb834f7d30.json';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const denied=()=>{throw Error('CREATOR_RELAY_REJECTED');};
/** Server-side prepared-evidence stage. No route may accept caller-declared preparation.
 * The Creator wrapper below always runs the retained authentic-account preflight.
 * Tests of this stage use synthetic prepared bytes, not authentic historical proof.
 */
export function createCreatorPreparedEvidenceRelay({enabled=false,manifest,readManifest,resolveJwks,claims,storage,now=Date.now}={}){
 if(enabled!==true)throw Error('CREATOR_RELAY_DISABLED');
 const write=validateCreatorOidcManifest(manifest),read=validateCreatorOidcManifest(readManifest);
 if(write.run_id===read.run_id||write.audience===read.audience||typeof now!=='function'||typeof resolveJwks!=='function'||['reserve','consume','consumeReadback'].some(k=>typeof claims?.[k]!=='function')||typeof storage?.put!=='function'||typeof storage?.read!=='function')denied();
 const identity={objectKey,runId:write.run_id,runAttempt:write.run_attempt,commit:write.sha};
 function time(){const ms=now();if(!Number.isSafeInteger(ms)||ms<0)denied();return Math.floor(ms/1000);}
 function live(policy){const t=time();if(t<policy.startsAt||t>=policy.expiresAt)denied();return t;}
 async function authenticate(token,policy,signal){
  try{screenCreatorGithubToken(token);live(policy);const jwks=await createCreatorExecutionBudget({maxDurationMs:5000}).run('JWKS',inner=>resolveJwks({signal:inner}),{signal});
  return verifyCreatorGithubOidc(token,{manifest:policy,jwks,nowSeconds:live(policy)});}catch{denied();}
 }
 function match(record){if(!record||Object.entries(identity).some(([k,v])=>record[k]!==v)||!/^[a-f0-9]{64}$/.test(record.payloadSha256)||!Number.isSafeInteger(record.byteLength)||record.byteLength<1||record.byteLength>1048576||!Number.isSafeInteger(record.expiresAt))denied();}
 async function bounded(label,policy,operation,{uncertain=false,signal:parentSignal}={}){
  live(policy);try{return await createCreatorExecutionBudget({maxDurationMs:Math.max(1,Math.min(15000,policy.expiresAt*1000-now()))}).run(label,async signal=>{live(policy);assertCreatorSignal(signal);const value=await operation(signal);assertCreatorSignal(signal);live(policy);return value;},{signal:parentSignal});}
  catch{throw Error(uncertain?'CREATOR_RELAY_RECONCILIATION_REQUIRED':'CREATOR_RELAY_REJECTED');}
 }
 return Object.freeze({
  async authenticateRequest({action,token,signal}){
   if(!['issue','upload','verify'].includes(action))denied();
   await authenticate(token,action==='verify'?read:write,signal);
   // No transferable proof/boolean. Operations independently verify again.
  },
  async issuePrepared({token,prepared,signal}){
   if(prepared?.status!=='READY_FOR_RESTRICTED_REVIEW'||prepared.objectKey!==objectKey||!Buffer.isBuffer(prepared.payload)||prepared.payload.length<1||prepared.payload.length>1048576)denied();
   const bytes=Buffer.from(prepared.payload),digest=hash(bytes);if(digest!==prepared.payloadSha256)denied();
   const auth=await authenticate(token,write,signal),scope={...write,expiresAt:auth.expiresAt};
   const expiresAt=Math.min(auth.expiresAt,write.expiresAt,time()+300);

   const capability=randomBytes(32).toString('base64url');
   const record={...identity,capabilityHash:hash(capability),payloadSha256:digest,byteLength:bytes.length,expiresAt,issuedTokenHash:auth.tokenIdHash};
   const saved=await bounded('RESERVE',scope,inner=>authorizeCreatorEvidenceUpload(
    {commit:write.sha,branch:write.ref,workflow:'creator-global-restricted-capture.yml',bucket,objectKey,overwrite:false,singleUse:true,used:false,expiresAtMs:expiresAt*1000},
    {approvedCommit:write.sha,nowMs:now(),claimOnce:()=>claims.reserve(structuredClone(record),{signal:inner}),
     // Reuse the retained one-shot coordinator for the opaque relay capability.
     // No native signed Storage token is minted or handed to the caller.
     issueSignedUpload:async()=>true}),{uncertain:true,signal});
   if(saved.authorized!==true)denied();return {capability,expiresAt,objectKey,eligibleForLivePromotion:false};
  },
  async upload({token,capability,payload,contentType='application/json',signal}){
   if(contentType!=='application/json')denied();
   if(typeof capability!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(capability)||!Buffer.isBuffer(payload)||payload.length<1||payload.length>1048576)denied();
   const bytes=Buffer.from(payload),payloadSha256=hash(bytes);
   const auth=await authenticate(token,write,signal),scope={...write,expiresAt:auth.expiresAt};
   // Atomic durable consumption precedes storage I/O. No release/retry on failure.
   const record=await bounded('CONSUME',scope,signal=>claims.consume({...identity,capabilityHash:hash(capability),payloadSha256,byteLength:bytes.length,tokenHash:auth.tokenIdHash,nowSeconds:time()},{signal}),{uncertain:true,signal});
   match(record);if(record.capabilityHash!==hash(capability)||record.payloadSha256!==payloadSha256||record.byteLength!==bytes.length||record.expiresAt<=time()||record.expiresAt>write.expiresAt)denied();
   const stored=await bounded('UPLOAD',{...scope,expiresAt:Math.min(scope.expiresAt,record.expiresAt)},signal=>{if(record.expiresAt<=time())denied();return storage.put(objectKey,Buffer.from(bytes),{overwrite:false,signal});},{uncertain:true,signal});
   if(stored!==true)throw Error('CREATOR_RELAY_RECONCILIATION_REQUIRED');
   return {status:'UPLOAD_REPORTED',eligibleForLivePromotion:false};
  },
  async verifyReadback({token,signal}){
   const auth=await authenticate(token,read,signal),scope={...read,expiresAt:auth.expiresAt};
   const record=await bounded('READBACK_CLAIM',scope,signal=>claims.consumeReadback({...identity,tokenHash:auth.tokenIdHash,nowSeconds:time(),deadlineSeconds:scope.expiresAt},{signal}),{uncertain:true,signal});match(record);
   const returned=await bounded('READBACK',scope,signal=>storage.read(objectKey,{signal}),{signal});
   if(verifyHistoricalEvidenceReadback({objectKey,payloadSha256:record.payloadSha256,payloadLength:record.byteLength},returned).status!=='READBACK_VERIFIED')denied();
   live(scope);assertCreatorSignal(signal);
   return {status:'READBACK_VERIFIED',payloadSha256:record.payloadSha256,eligibleForLivePromotion:false};
  }
 });
}
/** Only this wrapper is suitable for future route integration; still disabled/unwired. */
export function createCreatorEvidenceRelay(options={}){
 const engine=createCreatorPreparedEvidenceRelay(options);
 return Object.freeze({
  async issue({token,capture,signal}){try{await engine.authenticateRequest({action:'issue',token,signal});const prepared=prepareHistoricalGlobalRetention(capture);return await engine.issuePrepared({token,prepared,signal});}catch(error){if(error.message==='CREATOR_RELAY_RECONCILIATION_REQUIRED')throw error;denied();}},
  authenticateRequest:engine.authenticateRequest,upload:engine.upload,verifyReadback:engine.verifyReadback
 });
}
