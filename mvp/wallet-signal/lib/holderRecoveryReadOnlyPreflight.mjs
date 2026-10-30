import {assertPinnedHolderRecovery} from './holderRecoveryGuard.mjs';

/** Offline/read-only preflight. Requires a reader returning complete lease metadata. */
export async function readPinnedHolderRecoveryPreflight({readJob,jobId,mint,expectedVersion,now=new Date()}={}){
 if(typeof readJob!=='function')throw Error('RECOVERY_READER_REQUIRED');
 const job=await readJob(jobId);
 if(!job||!Object.hasOwn(job,'lease_owner')||!Object.hasOwn(job,'lease_expires_at'))throw Error('RECOVERY_LEASE_METADATA_MISSING');
 const identity=assertPinnedHolderRecovery({job,jobId,mint,version:expectedVersion,now});
 return Object.freeze({...identity,leaseExpired:job.lease_owner===null||Date.parse(job.lease_expires_at)<=now.getTime()});
}
