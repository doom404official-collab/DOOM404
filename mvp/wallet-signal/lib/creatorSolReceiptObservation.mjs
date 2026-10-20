/** Observe creator SOL movements from a parsed Solana transaction.
 * A net SOL increase does not prove pool-to-creator settlement.
 */
export function observeCreatorSolReceipt({transaction,creator}={}){
 if(!transaction||transaction.meta?.err!=null||typeof creator!=='string')
 return {status:'UNVERIFIED',reason:'INVALID_TRANSACTION'};
 const keys=(transaction.transaction?.message?.accountKeys||[]).map(k=>typeof k==='string'?k:k?.pubkey?.toString?.());
 const index=keys.indexOf(creator);
 if(index<0)return {status:'UNVERIFIED',reason:'CREATOR_ACCOUNT_NOT_FOUND'};
 const before=transaction.meta?.preBalances?.[index],after=transaction.meta?.postBalances?.[index];
 if(!Number.isSafeInteger(before)||!Number.isSafeInteger(after))
 return {status:'UNVERIFIED',reason:'BALANCE_DATA_MISSING'};
 const delta=after-before;
 return {status:delta>0?'NET_SOL_INCREASE_OBSERVED':'NO_NET_SOL_INCREASE',
  netLamports:delta,sourcePoolVerified:false,feeAdjusted:false,
  settlementVerified:false};
}
