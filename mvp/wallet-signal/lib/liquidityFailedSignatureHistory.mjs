export function previousFailedLiquiditySignatures(previous,poolAddress,{limit=40}={}){
 const records=(previous?.transactionEvidence??[]).filter(e=>e.pairAddress===poolAddress);
 const signatures=[];
 for(const record of records){
  for(const tx of record.decodedTransactions??[]){
   if(tx?.status==="unavailable"&&typeof tx.signature==="string"&&tx.signature.length<=100&&!signatures.includes(tx.signature))signatures.push(tx.signature);
   if(signatures.length>=Math.min(limit,40))return signatures;
  }
 }
 return signatures;
}
