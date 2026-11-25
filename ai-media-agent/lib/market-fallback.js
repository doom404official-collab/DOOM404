'use strict';
// Fixed endpoints only. Never infer constant-product prices from unknown vaults.
async function jupiterPrice(mint,{fetcher=fetch,now=Date.now()}={}){
 const source='https://lite-api.jup.ag/price/v3?ids='+encodeURIComponent(mint);
 try{const r=await fetcher(source,{redirect:'error',signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error();const data=await r.json(),p=data[mint];
 const price=Number(p?.usdPrice),stamp=Number(p?.createdAt); // Price v3 blockId is a slot, never a timestamp.
 if(!p||!Number.isFinite(price)||price<=0)return null;
 return {priceUsd:price,source:'Jupiter Price v3',sourceUrl:source,observedAt:new Date(now).toISOString(),providerBlockId:p.blockId??null,confidence:'SINGLE_PROVIDER_REPORTED',freshness:'RETRIEVAL_TIME_ONLY',limitation:'Provider update timestamp not supplied; retrieval time does not establish market freshness.'};
 }catch{return null;}
}
function reconcilePrices(primary,alternative){
 if(!primary)return alternative;if(!alternative)return primary;
 const difference=Math.abs(primary.priceUsd-alternative.priceUsd)/primary.priceUsd*100;
 return {...primary,crossSource:{alternative,relativeDifferencePercent:difference,status:difference>10?'CONFLICT':'WITHIN_10_PERCENT'},confidence:difference>10?'CONFLICTING_SOURCES':'CORROBORATED_REPORTED'};
}
module.exports={jupiterPrice,reconcilePrices};
