/** Read-only reconciliation of a frozen holder ranking and historical job.
 * Wallet identity mismatch is never automatically migrated.
 */
export function reconcileFrozenHolderRanking({snapshot,checkpoint}={}){
 if(!snapshot||!checkpoint||snapshot.mint!==checkpoint.mint||!Array.isArray(snapshot.holder_ranking)||!Array.isArray(checkpoint.holders))
  throw Error("HOLDER_RECONCILIATION_INVALID_INPUT");
 if(snapshot.status!=="frozen")throw Error("HOLDER_SNAPSHOT_NOT_FROZEN");
 const ranked=new Set(snapshot.holder_ranking.map(h=>h.wallet));
 const active=new Set(checkpoint.holders.map(h=>h.ownerWallet));
 if(ranked.size!==snapshot.holder_ranking.length||active.size!==checkpoint.holders.length)throw Error("HOLDER_RECONCILIATION_DUPLICATE_WALLET");
 const snapshotOnly=[...ranked].filter(w=>!active.has(w));
 const checkpointOnly=[...active].filter(w=>!ranked.has(w));
 const excluded=new Set(snapshot.excluded_wallets??[]);
 return {snapshotId:snapshot.id,jobMint:checkpoint.mint,matchingWallets:[...ranked].filter(w=>active.has(w)).length,
  snapshotOnly,checkpointOnly,excludedCheckpointWallets:checkpointOnly.filter(w=>excluded.has(w)),
  reconciliationRequired:snapshotOnly.length>0||checkpointOnly.length>0,
  safeToAttachSnapshot:snapshotOnly.length===0&&checkpointOnly.length===0,
  checkpointModified:false,historyReset:false,scorePromoted:false};
}
