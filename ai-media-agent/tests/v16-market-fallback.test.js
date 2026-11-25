const test=require('node:test'),assert=require('node:assert/strict');
const mint='EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const {marketFallback}=require('../lib/market-fallback');
function pricing(value,stamp=Math.floor(Date.now()/1000)){return async url=>({ok:true,json:async()=>url.includes('/price/v3')?{[mint]:value}:{result:stamp}})}
test('fallback validates exact decimals and dated price; conflicting sources fail closed',async()=>{const v={usdPrice:1,decimals:6,blockId:100};assert.equal((await marketFallback({mint,decimals:6,primary:null,fetchImpl:pricing(v)})).market.priceUsd,1);assert.equal((await marketFallback({mint,decimals:9,primary:null,fetchImpl:pricing(v)})).market,null);assert.equal((await marketFallback({mint,decimals:6,primary:null,fetchImpl:pricing(v,1)})).market,null);assert.equal((await marketFallback({mint,decimals:6,primary:{priceUsd:2},fetchImpl:pricing(v)})).diagnostics.status,'CONFLICTING_PRICES')});
