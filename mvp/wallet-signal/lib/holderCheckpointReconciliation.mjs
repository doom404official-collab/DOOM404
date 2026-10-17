/** Read-only reconciliation plan; never mutates an active scan checkpoint. */
export function planHolderCheckpointReconciliation({checkpoint,eligibleHolders,excludedWallets=[]}={}){
 if(!checkpoint||!Array.isArray(checkpoint.holders)||!checkpoint.wallets||
    !Array.isArray(eligibleHolders)||eligibleHolders.length!==20)
  throw Error("INVALID_RECONCILIATION_INPUT");
 const excluded=new Set(["1nc1nerator11111111111111111111111111111111",...excludedWallets]);
 const eligible=eligibleHolders.map(h=>typeof h==="string"?h:h?.wallet??h?.ownerWallet);
 if(eligible.some(w=>typeof w!=="string"||!w||excluded.has(w))||new Set(eligible).size!==20)
  throw Error("INVALID_ELIGIBLE_HOLDER_SET");
 const current=new Set(checkpoint.holders.map(h=>h.ownerWallet));
 const target=new Set(eligible);
 const reusable=eligible.filter(w=>current.has(w));
 const missing=eligible.filter(w=>!current.has(w));
 const removed=[...current].filter(w=>!target.has(w));
 return Object.freeze({
  eligibleWallets:20,reusableWallets:reusable,missingWallets:missing,
  excludedFromTarget:removed,requiresMigration:missing.length>0||removed.length>0,
  // Signature status is global to the old checkpoint, not per-wallet.
  // It must NOT be blindly copied to a new holder set.
  signatureStateTransferSafe:false,
  checkpointMutationPerformed:false
 });
}
