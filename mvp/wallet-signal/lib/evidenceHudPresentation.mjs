/** Display-only formatting. No score calculation, evidence promotion or network access. */
export function formatMetric(value,suffix=''){
 return typeof value==='number'&&Number.isFinite(value)?value.toLocaleString('en-US',{maximumFractionDigits:value>0&&value<0.01?6:2})+suffix:'Not assessed';
}
export function formatTokenQuantity(raw,decimals,compact=true){
 if(typeof raw!=='string'||!/^\d+$/.test(raw)||!Number.isInteger(decimals)||decimals<0||decimals>255)return 'Not assessed';
 const n=BigInt(raw),base=10n**BigInt(decimals),whole=n/base,fraction=(n%base).toString().padStart(decimals,'0').replace(/0+$/,'');
 if(!compact)return whole.toLocaleString('en-US')+(fraction?'.'+fraction:'');
 for(const [threshold,suffix] of [[1000000000n,'B'],[1000000n,'M'],[1000n,'K']])if(whole>=threshold){const scaled=n*100n/(base*threshold);return formatMetric(Number(scaled)/100)+suffix;}
 return whole.toLocaleString('en-US')+(fraction?'.'+fraction.slice(0,6)+(fraction.length>6?'…':''):'');
}
export function exitQuoteValue(q){
 if(q?.executable===false)return null;
 const n=q?.impactIncludingFeesPct??q?.quoteRecoveryShortfallPct??q?.providerPriceImpactPct;
 return typeof n==='number'&&Number.isFinite(n)&&n>=0?n:null;
}
