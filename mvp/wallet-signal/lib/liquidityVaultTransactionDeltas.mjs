export function calculateVaultTransactionDeltas(meta,keys,vaultAddresses=[]) {
 const before=meta?.preTokenBalances??[];
 const after=meta?.postTokenBalances??[];
 const results=[];
 for(const address of vaultAddresses){
  const index=keys.indexOf(address);
  if(index<0){results.push({vault:address,status:"vault_not_in_transaction",rawDelta:null});continue;}
  const pre=before.find(b=>b.accountIndex===index);
  const post=after.find(b=>b.accountIndex===index);
  if(!pre||!post||!/^[0-9]+$/.test(String(pre.uiTokenAmount?.amount))||!/^[0-9]+$/.test(String(post.uiTokenAmount?.amount))){
   results.push({vault:address,status:"missing_token_balance_evidence",rawDelta:null});continue;
  }
  results.push({vault:address,status:"observed",rawDelta:(BigInt(post.uiTokenAmount.amount)-BigInt(pre.uiTokenAmount.amount)).toString(),mintMatched:pre.mint===post.mint,mint:post.mint});
 }
 return {vaults:results,allVaultBalancesObserved:results.length>0&&results.every(x=>x.status==="observed"&&x.mintMatched),withdrawalConfirmed:false};
}
