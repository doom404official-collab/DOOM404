/** Offline-only preflight for a pinned historical Holder job. Never claims a lease or calls RPC. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function assertPinnedHolderRecovery({job,jobId,mint,version,now=new Date()}={}){
 if(!UUID.test(jobId||'')||typeof mint!=='string'||!mint||!Number.isSafeInteger(version)||version<0)throw Error('INVALID_RECOVERY_IDENTITY');
 if(!job||job.id!==jobId||job.mint!==mint||job.version!==version)throw Error('RECOVERY_IDENTITY_MISMATCH');
 if(!['queued','partial','running'].includes(job.status))throw Error('RECOVERY_JOB_NOT_RUNNABLE');
 if(!job.checkpoint||job.checkpoint.mint!==mint||!Array.isArray(job.checkpoint.holders)||job.checkpoint.holders.length!==20)throw Error('RECOVERY_CHECKPOINT_INVALID');
 if(job.checkpoint.archiveCompletenessProven===true)throw Error('RECOVERY_ALREADY_ARCHIVE_COMPLETE');
 if(!(now instanceof Date)||!Number.isFinite(now.getTime()))throw Error('RECOVERY_CLOCK_INVALID');
 if(job.lease_owner&&(!job.lease_expires_at||!Number.isFinite(Date.parse(job.lease_expires_at))||Date.parse(job.lease_expires_at)>now.getTime()))throw Error('RECOVERY_LEASE_ACTIVE_OR_UNKNOWN');
 return Object.freeze({jobId,mint,version});
}
