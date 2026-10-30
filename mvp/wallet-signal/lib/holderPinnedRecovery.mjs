import {createHolderRecoveryBudget} from './holderRecoveryBudget.mjs';
import {isDeepStrictEqual} from 'node:util';
import {assertPinnedHolderRecovery} from './holderRecoveryGuard.mjs';
import {processHolderScanJob} from './holderScanWorker.mjs';

/** One explicitly authorized job; never selects, creates, resets or retries a job. */
export async function runPinnedHolderRecovery({store,rpc,jobId,mint,expectedVersion,maxRequests=20,leaseSeconds=90,now=new Date(),budget=createHolderRecoveryBudget()}={}){
 if(!store||['getById','claim','renew','commit'].some(key=>typeof store[key]!=='function')||typeof rpc!=='function')throw Error('RECOVERY_DEPENDENCIES_INVALID');
 if(!Number.isSafeInteger(maxRequests)||maxRequests<1||maxRequests>20||!Number.isSafeInteger(leaseSeconds)||leaseSeconds<90||leaseSeconds>180)throw Error('RECOVERY_BUDGET_INVALID');
 const job=structuredClone(await budget.run('READ',signal=>store.getById(jobId,{signal})));
 assertPinnedHolderRecovery({job,jobId,mint,version:expectedVersion,now});
 let claimedCheckpoint,workerId,version,leaseExpiresAt,requests=0;
 let commitDiagnostic;
 const liveRow=(row,expected)=>row?.id===jobId&&row.mint===mint&&row.version===expected&&row.status==='running'&&row.lease_owner===workerId&&typeof row.lease_expires_at==='string'&&Date.parse(row.lease_expires_at)>Date.now();
 // Explicit calls preserve prototype methods and their original receiver.
 const guardedStore={
  async claim(id,worker,seconds){
   if(id!==jobId)throw Error('RECOVERY_JOB_ID_MISMATCH');
   workerId=worker;
   const row=await budget.run('CLAIM',signal=>store.claim(id,worker,seconds,{signal}));
   if(!row)return null;
   if(!liveRow(row,expectedVersion+1)||!isDeepStrictEqual(row.checkpoint,job.checkpoint))throw Error('RECOVERY_CLAIM_VERSION_MISMATCH');
   version=row.version;
   leaseExpiresAt=Date.parse(row.lease_expires_at);
   claimedCheckpoint=structuredClone(row.checkpoint);
   return {...row,checkpoint:structuredClone(row.checkpoint)};
  },
  async renew(id,worker,expected,seconds){
   if(id!==jobId||worker!==workerId||expected!==version)throw Error('RECOVERY_RENEW_INPUT_MISMATCH');
   const row=await budget.run('RENEW',signal=>store.renew(id,worker,expected,seconds,{signal}));
   if(!row)return null;
   if(!liveRow(row,expected+1)||!isDeepStrictEqual(row.checkpoint,claimedCheckpoint))throw Error('RECOVERY_RENEW_IDENTITY_MISMATCH');
   version=row.version;
   leaseExpiresAt=Date.parse(row.lease_expires_at);
   return row;
  },
  async commit(id,worker,expected,checkpoint,summary,status){
   if(id!==jobId||worker!==workerId||expected!==version||checkpoint.mint!==mint)throw Error('RECOVERY_COMMIT_INPUT_MISMATCH');
   // Preserve any prior diagnostic/scoring fields; the batch only adds progress.
   const preservedSummary={...job.summary,...summary,requestCount:requests};
   let row;
   commitDiagnostic={phase:'not_started',category:null,requestBytes:null,httpStatus:null};
   try{row=await budget.run('COMMIT',signal=>store.commit(id,worker,expected,checkpoint,preservedSummary,status,{signal,commitDiagnostic}));}
   catch(error){
    // Fixed vocabulary only: never publish transport messages, bodies or URLs.
    commitDiagnostic.category=error?.message==='RECOVERY_COMMIT_TIMEOUT'?'deadline':/^HOLDER_STORE_HTTP_[1-5][0-9]{2}$/.test(error?.message||'')?'http_rejected':commitDiagnostic.phase==='serialization'?'serialization_failed':commitDiagnostic.phase==='response_parse'?'response_parse_failed':commitDiagnostic.phase==='response_validation'?'response_invalid':'transport_or_store_failed';
    throw Error('RECOVERY_COMMIT_OUTCOME_UNKNOWN');
   }
   if(!row)return null;
   if(row.id!==jobId||row.mint!==mint||row.version!==expected+1||row.status!==status||row.lease_owner!==null||row.lease_expires_at!==null||!isDeepStrictEqual(row.checkpoint,checkpoint)||!isDeepStrictEqual(row.summary,preservedSummary)){commitDiagnostic.category='response_mismatch';throw Error('RECOVERY_COMMIT_OUTCOME_UNKNOWN');}
   return row;
  }
 };
 try{
  const result=await processHolderScanJob({store:guardedStore,jobId,rpc:async(method,params)=>{
   if(Date.now()>=leaseExpiresAt)throw Error('RECOVERY_LEASE_EXPIRED');
   if(requests>=maxRequests)throw Error('RECOVERY_REQUEST_LIMIT');
   return budget.run('PROVIDER',signal=>{requests++;return rpc(method,params,{signal});},{provider:true});
  },maxRequests,leaseSeconds});
  return {...result,requestCount:requests};
 }catch(error){
  if(['RECOVERY_CLAIM_TIMEOUT','RECOVERY_RENEW_TIMEOUT'].includes(error.message))return {status:error.message==='RECOVERY_CLAIM_TIMEOUT'?'CLAIM_OUTCOME_UNKNOWN':'RENEWAL_OUTCOME_UNKNOWN',jobId,requestCount:requests,reconciliationRequired:true,retryAllowed:false};
  if(error.message==='RECOVERY_COMMIT_OUTCOME_UNKNOWN')return {status:'COMMIT_OUTCOME_UNKNOWN',jobId,expectedVersion:version,requestCount:requests,reconciliationRequired:true,retryAllowed:false,commitDiagnostic:{...commitDiagnostic}};
  throw error;
 }
}
