// Read-only transaction-local observations. No historical account-state claims.
export function observeDiabVaults(tx,{pool,vaults=[]}={}){
 if(!tx?.transaction?.message||!tx.meta||tx.meta.err!==null||!Array.isArray(vaults)||vaults.length!==2)throw Error("INVALID_DIAB_OBSERVATION");
 const keys=(tx.transaction.message.accountKeys??[]).map(k=>typeof k==="string"?{pubkey:k}:k);
 const targets=new Set([pool,...vaults]);
 const accountRoles=keys.filter(k=>targets.has(k.pubkey)).map(k=>({address:k.pubkey,writable:k.writable??null,signer:k.signer??null}));
 const balances=[];
 for(const phase of ["preTokenBalances","postTokenBalances"]){
  for(const item of tx.meta[phase]??[]){
   const key=keys[item.accountIndex]?.pubkey;
   if(targets.has(key))balances.push({phase,account:key,mint:item.mint??null,owner:item.owner??null,amount:item.uiTokenAmount?.amount??null});
  }
 }
 const inner=tx.meta.innerInstructions;
 return {status:"OBSERVED_ONLY",slot:tx.slot,accountRoles,balances,innerMetadataState:inner===null?"null":Array.isArray(inner)?"present":"missing",innerInstructionCount:Array.isArray(inner)?inner.reduce((n,g)=>n+(g.instructions?.length??0),0):null,historicalStateVerified:false,scorePromoted:false};
}
