import {PublicKey} from '@solana/web3.js';
const SOL='So11111111111111111111111111111111111111112';
const raw=x=>typeof x==='string'&&/^[1-9][0-9]*$/.test(x)&&BigInt(x)<=18446744073709551615n;
export function quoteRecoveryShortfallPct(nominalRaw,outputRaw){
 if(!raw(nominalRaw)||!raw(outputRaw))return null;
 const nominal=BigInt(nominalRaw),output=BigInt(outputRaw);
 return output>=nominal?0:Number((nominal-output)*100000000n/nominal)/1000000;
}
export function validateAlchemyOrder(q,{inputMint,outputMint,amount}){
 try{
  if(q?.inputMint!==inputMint||q.outputMint!==outputMint||q.inAmount!==amount||!raw(q.outAmount)||q.swapMode!=='ExactIn'||q.transaction!=null||!Array.isArray(q.routePlan)||!q.routePlan.length||q.routePlan.length>40||typeof q.priceImpact!=='number'||!Number.isFinite(q.priceImpact)||Math.abs(q.priceImpact)>100)return null;
  const frac=Number(q.priceImpactPct);if(q.priceImpactPct!==undefined&&(!Number.isFinite(frac)||Math.abs(Math.abs(frac)*100-Math.abs(q.priceImpact))>0.05))return null;
  const pools=[...new Set(q.routePlan.map(r=>{const key=r.swapInfo?.ammKey;new PublicKey(key);return key;}))];
  return {inputMint,outputMint,inputRaw:amount,outputRaw:q.outAmount,providerPriceImpactPct:q.priceImpact>=0?q.priceImpact:null,providerSignedPriceImpactPct:q.priceImpact,routePoolAddresses:pools};
 }catch{return null;}
}
/** Four quote-only HTTP requests maximum. No taker, build, execute or transaction
 * submission. Provider-selected routes cover supported venues without inventing LP rules. */
export async function collectAlchemyQuotesV2({mint,rpcUrl,fetchImpl=fetch,signal}={}){
 try{
  const rpc=new URL(rpcUrl);if(rpc.protocol!=='https:'||rpc.hostname!=='solana-mainnet.g.alchemy.com'||!/^\/v2\/[^/]+\/?$/.test(rpc.pathname)||mint===SOL)return null;
  new PublicKey(mint);const root=rpc.origin+rpc.pathname.replace(/\/$/,'')+'/swap/v2/order';
  async function get(inputMint,outputMint,amount){
   if(signal?.aborted)throw Error('DEADLINE');const u=new URL(root);u.search=new URLSearchParams({inputMint,outputMint,amount,slippageBps:'50'}).toString();
   const response=await fetchImpl(u.toString(),{method:'GET',cache:'no-store',headers:{Accept:'application/json'},signal});if(!response.ok)throw Error('QUOTE_UNAVAILABLE');
   const data=await response.json(),validated=validateAlchemyOrder(data,{inputMint,outputMint,amount});if(!validated)throw Error('QUOTE_INVALID');return {...validated,observedAt:new Date().toISOString()};
  }
  const baseline=await get(SOL,mint,'10000000'); // 0.01 SOL; used only to define token input sizes
  const referenceQuotes=await Promise.all([1,10,100].map(async size=>{
   const amount=(BigInt(baseline.outputRaw)*BigInt(size)*100n).toString();if(!raw(amount))throw Error('AMOUNT_OUT_OF_RANGE');
   let q;try{q=await get(mint,SOL,amount);}catch(e){return {referenceNotional:size,referenceNotionalSol:size,quoteSymbol:'SOL',baseInputRaw:amount,executable:null,failureReason:signal?.aborted?'provider_timeout':e.message==='QUOTE_INVALID'?'invalid_or_no_route_returned':'provider_error',measurement:'unavailable_execution_estimate',feeCoverage:'unverified'};}
   return {referenceNotional:size,referenceNotionalSol:size,quoteSymbol:'SOL',baseInputRaw:amount,quoteOutputRaw:q.outputRaw,providerPriceImpactPct:q.providerPriceImpactPct,providerSignedPriceImpactPct:q.providerSignedPriceImpactPct,routePoolAddresses:q.routePoolAddresses,observedAt:q.observedAt,referenceQuoteValueRaw:(BigInt(size)*1000000000n).toString(),quoteRecoveryShortfallPct:quoteRecoveryShortfallPct((BigInt(size)*1000000000n).toString(),q.outputRaw),measurement:'reference_quote_recovery',referenceDefinition:'Token quantity scaled from a 0.01-SOL executable buy quote; approximate SOL notional, not an independently verified spot valuation.'};
  }));
  if(!referenceQuotes.some(q=>q.quoteOutputRaw))return null;
  return {version:2,mint,protocol:'alchemy_executable_routes',provider:'alchemy',observedAt:new Date().toISOString(),atomic:false,referenceQuotes,executableDepth:{verified:true,method:'provider_executable_quote',transactionSimulation:false},withdrawal:null,liquidityToMarketCapPct:null,flags:[{id:'route_lp_controls_unassessed',severity:'high',detail:'Executable routes are quoted, but pool-specific LP custody and withdrawal controls remain unassessed.'}],limitations:['Quoted routes may span PumpSwap, Raydium, Orca or other venues; no common LP-control model is assumed.','Quotes are observations, not guaranteed fills; protocol/network fee coverage and spot valuation are not independently certified.','Reference token amounts use an executable 0.01-SOL quote, and may differ from spot-value equivalents.','Signed provider impact is retained separately. Scoring uses observable quoted SOL recovery shortfall against the scaled small-buy reference, not an assumed impact sign or independent spot valuation.']};
 }catch{return null;}
}
