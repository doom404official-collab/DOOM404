"use strict";
const USDC="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
async function exitQuotes({mint,priceUsd,decimals,fetchImpl=fetch}){
 const sizes=[100,500,1000];
 const outputMint=mint===USDC?"So11111111111111111111111111111111111111112":USDC;
 const outputSymbol=outputMint===USDC?"USDC":"WSOL",outputDecimals=outputMint===USDC?6:9;
 if(!Number.isFinite(priceUsd)||priceUsd<=0||!Number.isInteger(decimals)||decimals<0||decimals>18)return sizes.map(targetUsd=>({targetUsd,status:"REFERENCE_UNAVAILABLE"}));
 return Promise.all(sizes.map(async targetUsd=>{
 const units=Math.floor(targetUsd/priceUsd*10**decimals);
 if(!Number.isSafeInteger(units)||units<=0)return {targetUsd,status:"AMOUNT_UNSUPPORTED"};
 const amount=String(units),observedAt=new Date().toISOString();
 try{
 const url="https://lite-api.jup.ag/swap/v1/quote?"+new URLSearchParams({inputMint:mint,outputMint,amount,slippageBps:"50",swapMode:"ExactIn"});
 const r=await fetchImpl(url,{signal:AbortSignal.timeout(5000),redirect:"error"});if(!r.ok)throw Error("QUOTE_UNAVAILABLE");
 const q=await r.json();
 if(q.inputMint!==mint||q.outputMint!==outputMint||q.inAmount!==amount||!/^\d+$/.test(q.outAmount)||BigInt(q.outAmount)<=0n||!Array.isArray(q.routePlan)||!q.routePlan.length)throw Error("QUOTE_MISMATCH");
 const outputAmount=Number(q.outAmount)/10**outputDecimals,proceedsUsdc=outputMint===USDC?outputAmount:null,referenceUsd=units/10**decimals*priceUsd;
 if(!Number.isFinite(outputAmount))throw Error("QUOTE_INVALID");
 return {targetUsd,status:"SELL_QUOTE_OBSERVED",inputMint:mint,inputRaw:amount,inputDecimals:decimals,outputMint,outputSymbol,outputDecimals,outputAmount,outputRaw:q.outAmount,proceedsUsdc,referenceUsd,referencePriceUsd:priceUsd,quoteDirection:"SELL_EXACT_IN",swapMode:"ExactIn",priceImpactPct:q.priceImpactPct??null,referenceDifferencePercent:proceedsUsdc===null?null:(referenceUsd-proceedsUsdc)/referenceUsd*100,observedAt,contextSlot:q.contextSlot??null,source:url,limitation:outputMint===USDC?"Read-only DEX quote; USDC assumed near one dollar for comparison. Reference difference is not pure slippage; network fees and execution changes excluded.":"Read-only USDC-to-WSOL DEX quote, not issuer redemption. No WSOL dollar parity assumed. Network fees and execution changes excluded."};
 }catch{return {targetUsd,status:"QUOTE_UNAVAILABLE",observedAt}}
 }));
}
module.exports={exitQuotes};
