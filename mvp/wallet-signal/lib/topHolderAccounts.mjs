/**
 * Validate externally indexed top holder accounts before graph analysis.
 * Does not infer owner identities, completeness or exchange/pool classifications.
 */
export function normalizeTopHolderAccounts({mint,rows=[],supplyRaw,source}={}){
 const total=typeof supplyRaw==="string"&&/^\d+$/.test(supplyRaw)?BigInt(supplyRaw):null;
 if(!total||total<=0n)return {status:"INVALID_SUPPLY",accounts:[]};
 if(!Array.isArray(rows)||rows.length<30)return {status:"INSUFFICIENT_TOP_HOLDERS",accounts:[],returned:rows?.length||0};
 const seen=new Set(),out=[];
 for(const row of rows.slice(0,30)){
  if(typeof row?.tokenAccount!=="string"||seen.has(row.tokenAccount)||typeof row?.ownerWallet!=="string"||
    typeof row?.amount!=="string"||!/^\d+$/.test(row.amount))return {status:"INVALID_HOLDER_RECORD",accounts:[]};
  seen.add(row.tokenAccount);
  const amount=BigInt(row.amount);
  if(amount>total)return {status:"INVALID_HOLDER_RECORD",accounts:[]};
  if(out.length&&amount>BigInt(out.at(-1).amount))return {status:"UNSORTED_HOLDER_DATA",accounts:[]};
  out.push({rank:out.length+1,tokenAccount:row.tokenAccount,ownerWallet:row.ownerWallet,amount:row.amount,
    sharePct:Number(amount*1000000n/total)/10000});
 }
 return {status:"TOP_30_ACCOUNTS_OBSERVED",mint,source:source||"unspecified",accounts:out,
  top30AccountSharePct:Number(out.reduce((sum,r)=>sum+BigInt(r.amount),0n)*1000000n/total)/10000,
  isCompleteHolderList:false,beneficialOwnersVerified:false};
}
