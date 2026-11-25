"use strict";
async function marketFallback({mint,decimals,primary,fetchImpl=fetch,rpcUrl=process.env.SOLANA_RPC_URL||'https://api.mainnet-beta.solana.com'}){
 const observedAt=new Date().toISOString(),source='https://api.jup.ag/price/v3?ids='+encodeURIComponent(mint);
 let candidate=null,reason='UNAVAILABLE';
 try{
  const r=await fetchImpl(source,{redirect:'error',signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error('PRICE_HTTP_'+r.status);
  const j=await r.json(),v=j[mint];if(!v||v.decimals!==decimals||!Number.isFinite(v.usdPrice)||v.usdPrice<=0||!Number.isInteger(v.blockId))throw Error('PRICE_IDENTITY_OR_UNITS_INVALID');
  const response=await fetchImpl(rpcUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'getBlockTime',params:[v.blockId]}),signal:AbortSignal.timeout(5000)});
  const stamp=(await response.json()).result;if(!Number.isInteger(stamp)||Date.now()-stamp*1000>300000||stamp*1000>Date.now()+30000)throw Error('STALE_OR_UNDATED_PRICE');
  candidate={priceUsd:v.usdPrice,decimals,slot:v.blockId,source,observedAt,priceObservedAt:new Date(stamp*1000).toISOString(),confidence:'PROVIDER_REPORTED_RECENT_SWAP',scope:'Jupiter derived USD price; not an executable exit quote or pool reserve valuation'};
  reason='OBSERVED';
 }catch(e){reason=/^[A-Z_0-9]+$/.test(e.message)?e.message:'UNAVAILABLE'}
 const difference=primary&&candidate?Math.abs(primary.priceUsd-candidate.priceUsd)/candidate.priceUsd*100:null;
 if(difference!==null&&difference>10)return {market:null,diagnostics:{status:'CONFLICTING_PRICES',differencePercent:difference,primary,candidate}};
 return {market:primary?{...primary,observedAt,confidence:candidate?'CROSS_SOURCE_CONSISTENT':'SINGLE_PROVIDER_REPORTED'}:candidate,diagnostics:{status:primary?'PRIMARY_SELECTED':candidate?'FALLBACK_SELECTED':'PRICE_UNAVAILABLE',fallbackStatus:reason,differencePercent:difference,candidate}};
}
module.exports={marketFallback};
