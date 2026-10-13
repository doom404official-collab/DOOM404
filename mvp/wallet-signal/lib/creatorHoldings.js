/** Summarize token accounts owned by a known wallet, using raw integer amounts. */
export function summarizeCreatorHoldings({mint,creator,tokenAccounts,supply}){
 if(!Array.isArray(tokenAccounts)||!supply||!/^\d+$/.test(String(supply.amount))||
    !Number.isInteger(supply.decimals)||supply.decimals<0||supply.decimals>18)throw Error("INVALID_HOLDINGS_INPUT");
 let raw=0n;
 const accounts=[];
 for(const item of tokenAccounts){
  const info=item?.account?.data?.parsed?.info;
  if(item?.account?.data?.parsed?.type!=="account"||info?.mint!==mint||info?.owner!==creator||
     !/^\d+$/.test(String(info?.tokenAmount?.amount)))throw Error("INVALID_TOKEN_ACCOUNT");
  const amount=BigInt(info.tokenAmount.amount);
  raw+=amount;
  accounts.push({tokenAccount:item.pubkey.toBase58(),rawAmount:amount.toString()});
 }
 const total=BigInt(supply.amount);
 const decimals=supply.decimals;
 const format=(n)=>{const base=10n**BigInt(decimals);return (n/base).toString()+(n%base?"."+(n%base).toString().padStart(decimals,"0").replace(/0+$/,""):"");};
 return {status:"ONCHAIN_BALANCE_OBSERVED",creator,mint,rawBalance:raw.toString(),
  uiBalance:format(raw),accountCount:accounts.length,accounts,
  supplySharePct:total>0n?Number(raw*1000000n/total)/10000:null,
  balanceObservedAt:"request_time",historicalSalesAssessed:false,linkedWalletsAssessed:false};
}
