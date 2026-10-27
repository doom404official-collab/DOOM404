import {readCreatorEvidenceBody} from './creatorEvidenceBody.mjs';
import {assertCreatorSignal} from './creatorExecutionBudget.mjs';
const objectKey='global/442809233/4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf/9aa57beb2b897cc175a536f170ddb25c0c8bed8ed6620c7087d8a7fb834f7d30.json';
const base='https://acwmtobcbpkjfqiatyke.supabase.co/storage/v1/object/';
/** Proposed narrow server identities supplied by separately approved integration.
 * No service-role fallback, signed URLs, environment access, credential refresh or retries.
 */
export function createCreatorEvidenceStorage({enabled=false,uploadIdentity,readbackIdentity,fetchImpl=fetch}={}){
 if(enabled!==true)throw Error('CREATOR_STORAGE_DISABLED');
 if(typeof uploadIdentity!=='function'||typeof readbackIdentity!=='function'||typeof fetchImpl!=='function')throw Error('CREATOR_STORAGE_CONFIGURATION');
 async function credential(provider,signal){assertCreatorSignal(signal);const value=await provider({signal});assertCreatorSignal(signal);if(typeof value!=='string'||!value||value.length>16384||/[\r\n]/.test(value))throw Error('CREATOR_STORAGE_IDENTITY_REQUIRED');return value;}
 return Object.freeze({
  async put(key,bytes,{overwrite=false,signal}={}){
   if(key!==objectKey||overwrite!==false||!Buffer.isBuffer(bytes)||bytes.length<1||bytes.length>1048576)throw Error('CREATOR_STORAGE_REJECTED');
   const payload=Buffer.from(bytes);let dispatched=false;
   try{const token=await credential(uploadIdentity,signal);assertCreatorSignal(signal);dispatched=true;
    const result=await fetchImpl(base+'creator-historical-evidence/'+objectKey,{method:'POST',redirect:'error',cache:'no-store',headers:{authorization:'Bearer '+token,'content-type':'application/json','x-upsert':'false'},body:payload,signal});
    assertCreatorSignal(signal);if(!result.ok)throw Error();return true;
   }catch{throw Error(dispatched?'CREATOR_STORAGE_RECONCILIATION_REQUIRED':'CREATOR_STORAGE_REJECTED');}
  },
  async read(key,{signal}={}){
   if(key!==objectKey)throw Error('CREATOR_STORAGE_REJECTED');
   try{const token=await credential(readbackIdentity,signal);assertCreatorSignal(signal);
    const result=await fetchImpl(base+'authenticated/creator-historical-evidence/'+objectKey,{method:'GET',redirect:'error',cache:'no-store',headers:{authorization:'Bearer '+token,'accept-encoding':'identity'},signal});
    assertCreatorSignal(signal);if(!result.ok)throw Error();return await readCreatorEvidenceBody(result,{maxBytes:1048576,signal});
   }catch{throw Error('CREATOR_STORAGE_REJECTED');}
  }
 });
}
