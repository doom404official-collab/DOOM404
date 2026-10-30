import {CreatorEvidenceReconciliation} from './creatorEvidenceUncertainty.mjs';
import {TEST_OBJECT,testBytes} from './creatorEvidenceTestProfile.mjs';
import {readCreatorEvidenceBody} from './creatorEvidenceBody.mjs';
import {assertCreatorSignal} from './creatorExecutionBudget.mjs';
const objectKey='global/442809233/4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf/9aa57beb2b897cc175a536f170ddb25c0c8bed8ed6620c7087d8a7fb834f7d30.json';
const base='https://acwmtobcbpkjfqiatyke.supabase.co/storage/v1/object/';
/** Proposed narrow server identities supplied by separately approved integration.
 * No service-role fallback, signed URLs, environment access, credential refresh or retries.
 */
function createStorage({enabled=false,uploadIdentity,readbackIdentity,publishableKey,fetchImpl=fetch}={},synthetic=false){
 const target=synthetic?TEST_OBJECT:objectKey;
 if(enabled!==true)throw Error('CREATOR_STORAGE_DISABLED');
 if(typeof publishableKey!=='string'||!/^sb_publishable_[A-Za-z0-9_-]{1,256}$/.test(publishableKey))throw Error('CREATOR_STORAGE_PUBLISHABLE_KEY_REQUIRED');
 if(typeof uploadIdentity!=='function'||typeof readbackIdentity!=='function'||typeof fetchImpl!=='function')throw Error('CREATOR_STORAGE_CONFIGURATION');
 async function credential(provider,signal){assertCreatorSignal(signal);const value=await provider({signal});assertCreatorSignal(signal);if(typeof value!=='string'||!value||value.length>16384||/[\r\n]/.test(value))throw Error('CREATOR_STORAGE_IDENTITY_REQUIRED');return value;}
 return Object.freeze({
  async put(key,bytes,{overwrite=false,signal}={}){
   if(key!==target||overwrite!==false||!Buffer.isBuffer(bytes)||bytes.length<1||bytes.length>1048576)throw Error('CREATOR_STORAGE_REJECTED');
   const payload=Buffer.from(bytes);if(synthetic&&!payload.equals(testBytes()))throw Error('CREATOR_STORAGE_REJECTED');let dispatched=false;
   try{const token=await credential(uploadIdentity,signal);assertCreatorSignal(signal);dispatched=true;
    const result=await fetchImpl(base+'creator-historical-evidence/'+target,{method:'POST',redirect:'error',cache:'no-store',headers:{apikey:publishableKey,authorization:'Bearer '+token,'content-type':'application/json','x-upsert':'false'},body:payload,signal});
    assertCreatorSignal(signal);if(!result.ok)throw Error();return true;
   }catch(error){if(error instanceof CreatorEvidenceReconciliation)throw error;throw Error(dispatched?'CREATOR_STORAGE_RECONCILIATION_REQUIRED':'CREATOR_STORAGE_REJECTED');}
  },
  async read(key,{signal}={}){
   if(key!==target)throw Error('CREATOR_STORAGE_REJECTED');
   try{const token=await credential(readbackIdentity,signal);assertCreatorSignal(signal);
    const result=await fetchImpl(base+'authenticated/creator-historical-evidence/'+target,{method:'GET',redirect:'error',cache:'no-store',headers:{apikey:publishableKey,authorization:'Bearer '+token,'accept-encoding':'identity'},signal});
    assertCreatorSignal(signal);if(!result.ok)throw Error();return await readCreatorEvidenceBody(result,{maxBytes:synthetic?1024:1048576,signal});
   }catch(error){if(error instanceof CreatorEvidenceReconciliation)throw error;throw Error('CREATOR_STORAGE_REJECTED');}
  }
 });
}

export const createCreatorEvidenceStorage=options=>createStorage(options);
export const createCreatorSyntheticEvidenceStorage=options=>createStorage(options,true);
