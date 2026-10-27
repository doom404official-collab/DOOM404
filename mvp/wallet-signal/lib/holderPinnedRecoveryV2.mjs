import {assertPinnedHolderRecovery} from './holderRecoveryGuard.mjs';
import {processHolderScanJob} from './holderScanWorker.mjs';

/** Explicit-job recovery adapter. Not wired to a workflow or API. */
export async function runPinnedHolderRecoveryV2({store,rpc,jobId,mint,expectedVersion,maxRequests=20,leaseSeconds=90,now=new Date()}={}){
 if(!store||typeof store.getById!=='function'||typeof store.claim!=='function'||typeof store.renew!=='function'||typeof store.commit!=='function'||typeof rpc!=='function')throw Error('RECOVERY_DEPENDENCIES_INVALID');
 if(!Number.isSafeInteger(maxRequests)||maxRequests<1||maxRequests>20||!Number.isSafeInteger(leaseSeconds)||leaseSeconds<90||leaseSeconds>180)throw Error('RECOVERY_BUDGET_INVALID');
 const job=await store.getById(jobId);
 assertPinnedHolderRecovery({job,jobId,mint,version:expectedVersion,now});
 const guardedStore={...store,claim:async(id,worker,seconds)=>{
  if(id!==jobId)throw Error('RECOVERY_JOB_ID_MISMATCH');
  const claimed=await store.claim(id,worker,seconds);
  if(!claimed)return null;
  if(claimed.id!==jobId||claimed.mint!==mint||claimed.version!==expectedVersion+1||claimed.checkpoint?.mint!==mint)throw Error('RECOVERY_CLAIM_VERSION_MISMATCH');
  return claimed;
 }};
 return processHolderScanJob({store:guardedStore,jobId,rpc,maxRequests,leaseSeconds});
}
