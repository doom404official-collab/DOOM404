/** Prevent stale holder graphs from being combined with a different live top-20 set.
 * Balance changes are allowed, but account-owner identities must match.
 */
export function reconcileHolderSnapshot(liveAccounts=[],cachedHolders=[]){
 if(!Array.isArray(liveAccounts)||!Array.isArray(cachedHolders)||liveAccounts.length!==20||cachedHolders.length!==20)
  return {compatible:false,reason:"INCOMPLETE_HOLDER_SET",holders:[]};
 const cached=new Map();
 for(const holder of cachedHolders){
  if(!holder?.tokenAccount||!holder?.ownerWallet||cached.has(holder.tokenAccount))
   return {compatible:false,reason:"INVALID_CACHED_HOLDERS",holders:[]};
  cached.set(holder.tokenAccount,holder.ownerWallet);
 }
 const holders=[];
 for(const account of liveAccounts){
  const tokenAccount=account?.tokenAccount,ownerWallet=account?.ownerWallet;
  if(!tokenAccount||!ownerWallet||cached.get(tokenAccount)!==ownerWallet)
   return {compatible:false,reason:"HOLDER_SET_CHANGED",holders:[]};
  const sharePct=Number(account.sharePct);
  if(!Number.isFinite(sharePct)||sharePct<0||sharePct>100)
   return {compatible:false,reason:"INVALID_LIVE_BALANCE",holders:[]};
  holders.push({tokenAccount,ownerWallet,sharePct});
 }
 if(new Set(holders.map(h=>h.tokenAccount)).size!==20)
  return {compatible:false,reason:"DUPLICATE_LIVE_ACCOUNT",holders:[]};
 return {compatible:true,reason:null,holders};
}
