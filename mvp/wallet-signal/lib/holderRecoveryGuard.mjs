/** Offline-only preflight for a pinned historical Holder job. Never claims a lease or calls RPC. */
const ALLOWED_JOBS=new Set(['c670f393-31b0-470c-a01f-cb2b813a1219','d07c0256-b472-4089-a237-99ed5e5c8cc4']);
const MINT='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function assertPinnedHolderRecovery({job,jobId,mint,version,now=new Date()}={}){
 if(!UUID.test(jobId||'')||typeof mint!=='string'||!mint||!Number.isSafeInteger(version)||version<0||version>Number.MAX_SAFE_INTEGER-3)throw Error('INVALID_RECOVERY_IDENTITY');
 if(!ALLOWED_JOBS.has(jobId)||mint!==MINT)throw Error('RECOVERY_ALLOWLIST_MISMATCH');
 if(!job||job.id!==jobId||job.mint!==mint||job.version!==version)throw Error('RECOVERY_IDENTITY_MISMATCH');
 if(!['queued','partial','running'].includes(job.status))throw Error('RECOVERY_JOB_NOT_RUNNABLE');
 if(!job.checkpoint||job.checkpoint.mint!==mint||!Array.isArray(job.checkpoint.holders)||job.checkpoint.holders.length!==20)throw Error('RECOVERY_CHECKPOINT_INVALID');
 if(job.checkpoint.archiveCompletenessProven!==false)throw Error('RECOVERY_ALREADY_ARCHIVE_COMPLETE');
 if(!(now instanceof Date)||!Number.isFinite(now.getTime()))throw Error('RECOVERY_CLOCK_INVALID');
 if(!Object.hasOwn(job,'lease_owner')||!Object.hasOwn(job,'lease_expires_at'))throw Error('RECOVERY_LEASE_METADATA_MISSING');
 if(job.lease_owner!==null&&(typeof job.lease_owner!=='string'||!job.lease_owner))throw Error('RECOVERY_LEASE_ACTIVE_OR_UNKNOWN');
 if(job.lease_owner===null&&job.lease_expires_at!==null)throw Error('RECOVERY_LEASE_ACTIVE_OR_UNKNOWN');
 if(job.lease_owner&&(!job.lease_expires_at||!Number.isFinite(Date.parse(job.lease_expires_at))||Date.parse(job.lease_expires_at)>now.getTime()))throw Error('RECOVERY_LEASE_ACTIVE_OR_UNKNOWN');
 const cp=job.checkpoint;
 if(!cp.wallets||!cp.signatures||!cp.edges||!cp.failedSignatures||[cp.wallets,cp.signatures,cp.edges,cp.failedSignatures].some(v=>typeof v!=='object'||Array.isArray(v))||cp.holders.some(h=>!h||typeof h.ownerWallet!=='string'||!cp.wallets[h.ownerWallet])||Object.values(cp.wallets).some(w=>!w||typeof w.exhausted!=='boolean'||!Number.isSafeInteger(w.pages)||w.pages<0||!Number.isSafeInteger(w.signaturesSeen)||w.signaturesSeen<0)||(cp.nextWalletIndex!==undefined&&(!Number.isSafeInteger(cp.nextWalletIndex)||cp.nextWalletIndex<0||cp.nextWalletIndex>=20)))throw Error('RECOVERY_CHECKPOINT_INVALID');
 return Object.freeze({jobId,mint,version});
}
