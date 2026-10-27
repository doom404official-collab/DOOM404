import {assertPinnedHolderRecovery} from './holderRecoveryGuard.mjs';
import {processHolderScanJob} from './holderScanWorker.mjs';

/** Trusted server-side adapter. No scheduler, HTTP route, or automatic execution. */
export async function runPinnedHolderRecovery({store,rpc,jobId,mint,expectedVersion,maxRequests=20,leaseSeconds=90,now=new Date()}={}){
 if(!store||typeof store.getById!=='function'||typeof store.claim!=='function'||typeof store.renew!=='function'||typeof store.commit!=='function'||typeof rpc!=='function')throw Error('RECOVERY_DEPENDENCIES_INVALID');
 if(!Number.isSafeInteger(maxRequests)||maxRequests<1||maxRequests>20||!Number.isSafeInteger(leaseSeconds)||leaseSeconds<90||leaseSeconds>180)throw Error('RECOVERY_BUDGET_INVALID');
 const job=await store.getById(jobId);
 assertPinnedHolderRecovery({job,jobId,mint,version:expectedVersion,now});
 // A second version/identity assertion occurs on the atomic claim response.
 const guardedStore={...store,claim:async(id,worker,seconds)=>{
  const claimed=await store.claim(id,worker,seconds);
  if(!claimed)return null;
  if(claimed.version!==expectedVersion||claimed.checkpoint?.mint!==mint)throw Error('RECOVERY_CLAIM_VERSION_MISMATCH');
  return claimed;
 }};
 return processHolderScanJob({store:guardedStore,jobId,rpc,maxRequests,leaseSeconds});
}
