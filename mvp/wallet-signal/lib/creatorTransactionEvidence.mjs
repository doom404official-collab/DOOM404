/** Conservative on-chain creator transaction observation.
 * SPL balance decreases alone never establish a sale.
 */
export function observeCreatorTransaction({signature,transaction,creator,mint}={}){
 if(typeof signature!=='string'||!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signature)||!transaction||typeof creator!=='string'||typeof mint!=='string')throw Error('INVALID_CREATOR_TRANSACTION');
 if(transaction.meta?.err!=null)return {signature,status:'FAILED_TRANSACTION',verifiedSale:null};
 const timestamp=transaction.blockTime;
 const pre=transaction.meta?.preTokenBalances||[];
 const post=transaction.meta?.postTokenBalances||[];
 const balance=items=>items.filter(x=>x?.mint===mint&&x?.owner===creator).reduce((sum,x)=>sum+BigInt(x?.uiTokenAmount?.amount||'0'),0n);
 const before=balance(pre),after=balance(post);
 const outflow=before>after?before-after:0n;
 return {signature,status:outflow>0n?'TOKEN_OUTFLOW_UNCLASSIFIED':'NO_CREATOR_TOKEN_OUTFLOW_OBSERVED',
  timestamp:Number.isSafeInteger(timestamp)?timestamp:null,
  creatorTokenOutflowRaw:outflow.toString(),verifiedSale:null,
  swapVerification:'NOT_VERIFIED',historyCoverageComplete:false};
}
