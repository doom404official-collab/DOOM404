/** Strict creator signer and mint-bound token-flow corroboration.
 * This is necessary but not sufficient for a verified Pump.fun swap.
 */
export function corroborateCreatorSellFlows({transaction,creator,mint,claimedSoldRaw}={}){
 if(!transaction||transaction.meta?.err!=null||typeof creator!=='string'||typeof mint!=='string'||
 !/^[0-9]+$/.test(String(claimedSoldRaw))||BigInt(claimedSoldRaw)<=0n)
 return {status:'UNVERIFIED',reason:'INVALID_INPUT'};
 const keys=transaction.transaction?.message?.accountKeys||[];
 const signer=keys.some(k=>typeof k==='object'&&k.pubkey?.toString?.()===creator&&k.signer===true);
 if(!signer)return {status:'UNVERIFIED',reason:'CREATOR_NOT_SIGNER'};
 const pre=transaction.meta?.preTokenBalances||[],post=transaction.meta?.postTokenBalances||[];
 const balance=arr=>arr.filter(x=>x?.mint===mint&&x?.owner===creator)
  .reduce((sum,x)=>sum+BigInt(x.uiTokenAmount?.amount||'0'),0n);
 const sold=balance(pre)-balance(post);
 if(sold<BigInt(claimedSoldRaw))return {status:'UNVERIFIED',reason:'TOKEN_OUTFLOW_NOT_CORROBORATED'};
 const idx=keys.findIndex(k=>(typeof k==='string'?k:k?.pubkey?.toString?.())===creator);
 const preSol=transaction.meta?.preBalances?.[idx],postSol=transaction.meta?.postBalances?.[idx];
 if(idx<0||!Number.isSafeInteger(preSol)||!Number.isSafeInteger(postSol))
 return {status:'UNVERIFIED',reason:'SOL_BALANCE_EVIDENCE_MISSING'};
 const netSol=postSol-preSol;
 return {status:'FLOW_OBSERVED',soldRaw:sold.toString(),netSolLamports:netSol,
  solReceiptIndependentlyVerified:false,protocolInstructionVerified:false,saleVerified:false};
}
