const raw=x=>typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)&&x.length<=20&&BigInt(x)<=18446744073709551615n;
export function calculateVaultTransactionDeltas(meta,keys,vaultAddresses=[]) {
 const before=meta?.preTokenBalances,after=meta?.postTokenBalances;
 const results=[];
 for(const address of vaultAddresses){
  const unavailable=status=>({vault:address,status,rawDelta:null,mintMatched:false});
  if(meta?.err!==null||!Array.isArray(keys)||!Array.isArray(before)||!Array.isArray(after)){results.push(unavailable('missing_token_balance_evidence'));continue;}
  const index=keys.indexOf(address);
  if(index<0){results.push(unavailable('vault_not_in_transaction'));continue;}
  const preRows=before.filter(b=>b?.accountIndex===index),postRows=after.filter(b=>b?.accountIndex===index);
  if(keys.filter(k=>k===address).length!==1||preRows.length!==1||postRows.length!==1){results.push(unavailable('ambiguous_token_balance_evidence'));continue;}
  const pre=preRows[0],post=postRows[0];
  if(!raw(pre.uiTokenAmount?.amount)||!raw(post.uiTokenAmount?.amount)){results.push(unavailable('missing_token_balance_evidence'));continue;}
  if(typeof pre.mint!=='string'||!pre.mint||pre.mint!==post.mint){results.push(unavailable('token_balance_mint_mismatch'));continue;}
  results.push({vault:address,status:'observed',rawDelta:(BigInt(post.uiTokenAmount.amount)-BigInt(pre.uiTokenAmount.amount)).toString(),mintMatched:true,mint:post.mint});
 }
 return {vaults:results,allVaultBalancesObserved:results.length>0&&results.every(x=>x.status==='observed'&&x.mintMatched),withdrawalConfirmed:false};
}
