import {isDeepStrictEqual} from 'node:util';
import {assertPinnedHolderRecovery} from './holderRecoveryGuard.mjs';
import {processHolderScanJob} from './holderScanWorker.mjs';

/** One explicitly authorized job; never selects, creates, resets or retries a job. */
export async function runPinnedHolderRecovery({store,rpc,jobId,mint,expectedVersion,maxRequests=20,leaseSeconds=90,now=new Date()}={}){
 if(!store||['getById','claim','renew','commit'].some(key=>typeof store[key]!=='function')||typeof rpc!=='function')throw Error('RECOVERY_DEPENDENCIES_INVALID');
 if(!Number.isSafeInteger(maxRequests)||maxRequests<1||maxRequests>20||!Number.isSafeInteger(leaseSeconds)||leaseSeconds<90||leaseSeconds>180)throw Error('RECOVERY_BUDGET_INVALID');
 const job=structuredClone(await store.getById(jobId));
 assertPinnedHolderRecovery({job,jobId,mint,version:expectedVersion,now});
 let claimedCheckpoint,workerId,version,leaseExpiresAt,requests=0;
 const liveRow=(row,expected)=>row?.id===jobId&&row.mint===mint&&row.version===expected&&row.status==='running'&&row.lease_owner===workerId&&typeof row.lease_expires_at==='string'&&Date.parse(row.lease_expires_at)>Date.now();
 // Explicit calls preserve prototype methods and their original receiver.
 const guardedStore={
  async claim(id,worker,seconds){
   if(id!==jobId)throw Error('RECOVERY_JOB_ID_MISMATCH');
   workerId=worker;
   const row=await store.claim(id,worker,seconds);
   if(!row)return null;
   if(!liveRow(row,expectedVersion+1)||!isDeepStrictEqual(row.checkpoint,job.checkpoint))throw Error('RECOVERY_CLAIM_VERSION_MISMATCH');
   version=row.version;
   leaseExpiresAt=Date.parse(row.lease_expires_at);
   claimedCheckpoint=structuredClone(row.checkpoint);
   return {...row,checkpoint:structuredClone(row.checkpoint)};
  },
  async renew(id,worker,expected,seconds){
   if(id!==jobId||worker!==workerId||expected!==version)throw Error('RECOVERY_RENEW_INPUT_MISMATCH');
   const row=await store.renew(id,worker,expected,seconds);
   if(!row)return null;
   if(!liveRow(row,expected+1)||!isDeepStrictEqual(row.checkpoint,claimedCheckpoint))throw Error('RECOVERY_RENEW_IDENTITY_MISMATCH');
   version=row.version;
   leaseExpiresAt=Date.parse(row.lease_expires_at);
   return row;
  },
  async commit(id,worker,expected,checkpoint,summary,status){
   if(id!==jobId||worker!==workerId||expected!==version||checkpoint.mint!==mint)throw Error('RECOVERY_COMMIT_INPUT_MISMATCH');
   // Preserve any prior diagnostic/scoring fields; the batch only adds progress.
   const preservedSummary={...job.summary,...summary};
   let row;
   try{row=await store.commit(id,worker,expected,checkpoint,preservedSummary,status);}
   catch{throw Error('RECOVERY_COMMIT_OUTCOME_UNKNOWN');}
   if(!row)return null;
   if(row.id!==jobId||row.mint!==mint||row.version!==expected+1||row.status!==status||row.lease_owner!==null||row.lease_expires_at!==null||!isDeepStrictEqual(row.checkpoint,checkpoint)||!isDeepStrictEqual(row.summary,preservedSummary))throw Error('RECOVERY_COMMIT_OUTCOME_UNKNOWN');
   return row;
  }
 };
 try{
  return await processHolderScanJob({store:guardedStore,jobId,rpc:async(...args)=>{
   if(Date.now()>=leaseExpiresAt)throw Error('RECOVERY_LEASE_EXPIRED');
   if(requests>=maxRequests)throw Error('RECOVERY_REQUEST_LIMIT');
   requests++;return rpc(...args);
  },maxRequests,leaseSeconds});
 }catch(error){
  if(error.message==='RECOVERY_COMMIT_OUTCOME_UNKNOWN')return {status:'COMMIT_OUTCOME_UNKNOWN',jobId,expectedVersion:version,requestCount:requests,reconciliationRequired:true,retryAllowed:false};
  throw error;
 }
}
