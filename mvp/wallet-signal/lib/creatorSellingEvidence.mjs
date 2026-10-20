/** Evidence-first creator selling classifier. Token transfers are never sales.
 * Requires an independently verified swap with explicit input token quantity.
 */
export const CREATOR_SELL_WINDOWS=Object.freeze([3600,86400,604800]);
export function summarizeCreatorSelling({launchTimestamp,initialAttributableRaw,transactions=[],historyCompleteByWindow={}}={}){
 if(!Number.isSafeInteger(launchTimestamp)||launchTimestamp<=0||!/^[0-9]+$/.test(String(initialAttributableRaw)))throw Error('INVALID_CREATOR_SELLING_INPUT');
 const initial=BigInt(initialAttributableRaw);
 const seen=new Set(),sales=[];
 for(const tx of transactions){
  if(!tx||typeof tx.signature!=='string'||seen.has(tx.signature))continue;
  seen.add(tx.signature);
  if(tx.kind!=='VERIFIED_SWAP_SELL'||tx.independentlyVerified!==true||tx.inputMintVerified!==true||
     !Number.isSafeInteger(tx.timestamp)||tx.timestamp<launchTimestamp||!/^[0-9]+$/.test(String(tx.soldRaw)))continue;
  sales.push({signature:tx.signature,timestamp:tx.timestamp,soldRaw:String(tx.soldRaw)});
 }
 return {status:'OBSERVED_SELLING_EVIDENCE',methodology:'CREATOR_SELLING_V1_1',
  windows:CREATOR_SELL_WINDOWS.map(seconds=>{
   const sold=sales.filter(tx=>tx.timestamp-launchTimestamp<=seconds).reduce((sum,tx)=>sum+BigInt(tx.soldRaw),0n);
   const complete=historyCompleteByWindow[seconds]===true;
   return {seconds,verifiedSoldRaw:sold.toString(),historyComplete:complete,
    sellThroughPct:complete&&initial>0n?Number(sold*1000000n/initial)/10000:null,
    scoreEligible:complete&&initial>0n};
  }),verifiedSales:sales,unverifiedTransactionsExcluded:transactions.length-sales.length,
  creatorSellingScoreEligible:CREATOR_SELL_WINDOWS.every(seconds=>historyCompleteByWindow[seconds]===true)&&initial>0n};
}
