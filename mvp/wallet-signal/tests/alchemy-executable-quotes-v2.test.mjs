import test from 'node:test';import assert from 'node:assert/strict';import {collectAlchemyQuotesV2,validateAlchemyOrder} from '../lib/alchemyExecutableQuotesV2.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump',sol='So11111111111111111111111111111111111111112';
const quote=(inputMint,outputMint,amount)=>({inputMint,outputMint,inAmount:amount,outAmount:'1000000',swapMode:'ExactIn',priceImpact:-0.5,priceImpactPct:'-0.005',transaction:null,routePlan:[{swapInfo:{ammKey:mint}}]});
test('quote-only requests are bounded and cannot cross token identities or expose transactions',async()=>{
 let calls=0;const fetchImpl=async url=>{calls++;const u=new URL(url);assert.equal(u.hostname,'solana-mainnet.g.alchemy.com');assert.equal(u.searchParams.has('taker'),false);return Response.json(quote(u.searchParams.get('inputMint'),u.searchParams.get('outputMint'),u.searchParams.get('amount')));};
 const r=await collectAlchemyQuotesV2({mint,rpcUrl:'https://solana-mainnet.g.alchemy.com/v2/secret',fetchImpl});assert.ok(r);assert.equal(calls,4);assert.equal(r.referenceQuotes.length,3);assert.equal(r.withdrawal,null);assert.equal(r.referenceQuotes[0].providerPriceImpactPct,null);assert.equal(r.referenceQuotes[0].providerSignedPriceImpactPct,-0.5);assert.ok(!JSON.stringify(r).includes('secret'));
 const q=quote(mint,sol,'1');assert.equal(validateAlchemyOrder({...q,outputMint:mint},{inputMint:mint,outputMint:sol,amount:'1'}),null);assert.equal(validateAlchemyOrder({...q,transaction:'unsigned-bytes'},{inputMint:mint,outputMint:sol,amount:'1'}),null);
});
test('unavailable entitlement or provider fails once without purchase, retries or fallback assumptions',async()=>{
 let calls=0;const r=await collectAlchemyQuotesV2({mint,rpcUrl:'https://solana-mainnet.g.alchemy.com/v2/secret',fetchImpl:async()=>{calls++;return new Response(null,{status:403});}});assert.equal(r,null);assert.equal(calls,1);
 assert.equal(await collectAlchemyQuotesV2({mint,rpcUrl:'https://malicious.invalid/v2/secret',fetchImpl:()=>{throw Error('must not send');}}),null);
});
