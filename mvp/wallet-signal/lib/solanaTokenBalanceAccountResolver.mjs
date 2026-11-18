/** Resolve RPC token-balance accountIndex against transaction account keys.
 * Solana getTransaction token balance entries use accountIndex, not accountPubkey.
 */
export function resolveTokenBalanceAccounts({transaction}={}){
 if(!transaction)return {status:'INVALID_TRANSACTION',pre:[],post:[]};
 const message=transaction.transaction?.message||{};
 const keys=[...(message.accountKeys||[]),...(transaction.meta?.loadedAddresses?.writable||[]),
  ...(transaction.meta?.loadedAddresses?.readonly||[])].map(k=>typeof k==='string'?k:k?.pubkey?.toString?.());
 const resolve=(items)=>(items||[]).map(item=>{
  const index=item?.accountIndex;
  return {...item,accountPubkey:Number.isInteger(index)&&index>=0?keys[index]||null:null};
 });
 return {status:'RESOLVED',pre:resolve(transaction.meta?.preTokenBalances),
  post:resolve(transaction.meta?.postTokenBalances),accountCount:keys.length};
}
