import {createCreatorIntelligenceJobStoreV2} from './creatorIntelligenceJobStoreV2.mjs';
import {runCreatorIntelligenceTick} from './creatorIntelligenceTick.mjs';
import {assertCreatorSignal} from './creatorExecutionBudget.mjs';

// Preparation only: no environment activation, enqueue, workflow or CLI entry.
// Reuse the reviewed engine so reservation and evidence semantics stay identical.
export async function runCreatorIntelligenceV2({enabled=false,storeConfig,fetchImpl=fetch,...tick}={}){
 if(enabled!==true)throw Error('CREATOR_V2_RUNNER_DISABLED');
 if(Object.hasOwn(tick,'store')||typeof fetchImpl!=='function')throw Error('CREATOR_V2_RUNNER_CONFIGURATION');
 const store=createCreatorIntelligenceJobStoreV2({...storeConfig,enabled:true});
 const now=storeConfig?.now||Date.now;
 let before,claimed,proof,providerStopped=false;
 const active=()=>{
  const wall=now(),expiry=Date.parse(proof?.leaseUntil);
  if(!proof||proof.status!=='running'||!Number.isSafeInteger(wall)||!Number.isFinite(expiry)||expiry<=wall||expiry-wall>180000)throw Error('CREATOR_V2_LEASE_INVALID');
 };
 const bridge={
  async get(mint,{signal}={}){
   if(claimed){assertCreatorSignal(signal);active();const value=structuredClone(claimed);claimed=null;return value;}
   before=await store.read(mint,{signal});return before;
  },
  async claim(mint,owner,seconds,{signal}={}){
   if(!before||before.mint!==mint)throw Error('CREATOR_V2_READ_REQUIRED');
   const result=await store.claim({mint,owner,expectedRevision:before.revision,leaseSeconds:seconds},{signal});
   proof=result.receipt;claimed=result.job;active();return true;
  },
  async save(value,{signal}={}){
   active();
   // Every running reservation and final save consumes the last returned revision.
   proof=await store.save({...value,expectedRevision:proof.revision,leaseUntil:proof.leaseUntil},{signal});
   return true;
  }
 };
 const result=await runCreatorIntelligenceTick({...tick,store:bridge,fetchImpl:async(url,options)=>{
  assertCreatorSignal(options?.signal);active();
  if(providerStopped)throw Error('CREATOR_V2_PROVIDER_STOPPED');
  try{
   const response=await fetchImpl(url,options);assertCreatorSignal(options?.signal);active();
   // The legacy RPC helper retries HTTP 429. This path never hands it a
   // retryable response and never sends another request after transport failure.
   if(!response.ok)throw Error(response.status===429?'RPC_RATE_LIMITED':'RPC_HTTP_ERROR');
   return response;
  }catch(error){providerStopped=true;throw error;}
 }});
 return {...result,revision:proof?.revision??before?.revision??null};
}
