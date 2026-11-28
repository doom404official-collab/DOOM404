import {createHash} from 'node:crypto';

/** Original ordered account/owner identity. Balances and slots are not hashed.
 * A matching hash establishes identity only, never historical provenance. */
export function holderSetHash({mint,holders}){
 if(typeof mint!=='string'||!mint||!Array.isArray(holders)||!holders.length||holders.length>20)
  throw Error('INVALID_HOLDER_SET');
 const accounts=holders.map(h=>{
  if(typeof h?.tokenAccount!=='string'||!h.tokenAccount||typeof h.ownerWallet!=='string'||!h.ownerWallet)
   throw Error('HOLDER_ACCOUNT_IDENTITY_MISSING');
  return [h.tokenAccount,h.ownerWallet];
 });
 if(new Set(accounts.map(a=>a[0])).size!==accounts.length)throw Error('DUPLICATE_HOLDER_ACCOUNT');
 return createHash('sha256').update(JSON.stringify({mint,accounts})).digest('hex');
}

/** Never reconstruct frozen account identities from a different investigation. */
export function reconcileHolderIdentities({mint,jobs,snapshots}){
 if(!Array.isArray(jobs)||!Array.isArray(snapshots))throw Error('INVALID_RECONCILIATION_INPUT');
 return {version:1,mint,canonicalJobId:null,automaticRecoveryAllowed:false,
  jobs:jobs.map(job=>{
   const holders=job.holders??job.checkpoint?.holders;
   const recomputedHash=holderSetHash({mint,holders});
   return {id:job.id,version:job.version,storedHash:job.hash??job.holder_set_hash,recomputedHash,
    hashMatches:recomputedHash===(job.hash??job.holder_set_hash),
    snapshots:snapshots.map(snapshot=>{
     const ranking=snapshot.ranking??snapshot.holder_ranking;
     if(!Array.isArray(ranking)||new Set(ranking.map(h=>h.wallet)).size!==ranking.length)
      throw Error('INVALID_FROZEN_RANKING');
     const snapshotOnly=ranking.filter(h=>!holders.some(x=>x.ownerWallet===h.wallet)).map(h=>h.wallet);
     const checkpointOnly=holders.filter(h=>!ranking.some(x=>x.wallet===h.ownerWallet)).map(h=>h.ownerWallet);
     const missingAccounts=ranking.some(h=>typeof h.tokenAccount!=='string'||!h.tokenAccount);
     return {id:snapshot.id,slot:snapshot.slot??snapshot.snapshot_slot,snapshotOnly,checkpointOnly,
      walletSetMatches:!snapshotOnly.length&&!checkpointOnly.length,
      frozenAccountHash:missingAccounts?null:holderSetHash({mint,holders:ranking.map(h=>({tokenAccount:h.tokenAccount,ownerWallet:h.wallet}))}),
      hashBlocker:missingAccounts?'FROZEN_TOKEN_ACCOUNT_IDENTITIES_NOT_RETAINED':null,
      safeToAttachSnapshot:false,snapshotProvenanceVerified:false};
    })};
  })};
}
