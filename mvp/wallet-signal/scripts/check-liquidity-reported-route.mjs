// Actual compiled API; every provider response is offline and synthetic.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{GET}=require('../.next/server/app/api/token-liquidity/route.js').routeModule.userland;
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump',pair='11111111111111111111111111111111';
const row=n=>({chainId:'solana',pairAddress:pair,baseToken:{address:mint},liquidity:{usd:n}});
let payload,calls=0;const original=global.fetch;
global.fetch=async url=>{assert.equal(new URL(url).origin,'https://api.dexscreener.com');calls++;return Response.json(payload);};
try{
 for(const [input,amount,status] of [[[row(100),row(100)],100,200],[[row(100),row(200)],null,200],[[row(200),row(100)],null,200],[[],null,200],[{},undefined,503]]){
  payload=input;const response=await GET(new Request('https://offline.invalid/api/token-liquidity?mint='+mint));assert.equal(response.status,status);const body=await response.json();assert.equal(body.reportedLiquidityUsd,amount);if(status===200){assert.equal(body.coverage.reservesVerified,false);assert.equal(body.coverage.withdrawalRightsVerified,false);}
 }
 assert.equal(calls,5);console.log('Compiled reported Liquidity route: 5 no-network cases passed');
}finally{global.fetch=original;}
