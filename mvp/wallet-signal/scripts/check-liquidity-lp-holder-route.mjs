// Compiled read-only route with mock transport only; no hosted account reads.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{PublicKey}=require('@solana/web3.js');
process.env.SOLANA_RPC_URL='https://offline.invalid';process.env.SOLANA_RPC_FALLBACK_URLS='';
const {POST}=require('../.next/server/app/api/lp-holder-evidence/route.js').routeModule.userland;
const mint=new PublicKey(Buffer.alloc(32,1)).toBase58(),account=new PublicKey(Buffer.alloc(32,3)).toBase58(),program='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
let data,owner,calls=0;const original=global.fetch;
global.fetch=async(url,o)=>{assert.equal(new URL(url).origin,'https://offline.invalid');calls++;const q=JSON.parse(o.body);let value;
 if(q.method==='getTokenLargestAccounts')value=[{address:account,amount:'50',decimals:0,uiAmount:50,uiAmountString:'50'}];
 else if(q.method==='getMultipleAccounts')value=[{owner,lamports:1,executable:false,rentEpoch:0,data:[data.toString('base64'),'base64']}];
 else{assert.equal(q.method,'getTokenSupply');value={amount:'50',decimals:0,uiAmount:50,uiAmountString:'50'};}
 return Response.json({jsonrpc:'2.0',id:q.id,result:{context:{slot:123},value}});
};
try{
 let cases=0;
 for(const [name,mutate,count] of [['valid token account',()=>{},1],['foreign owner',()=>owner=mint,0],['wrong mint',()=>data.fill(4,0,32),0],['uninitialized',()=>data[108]=0,0]]){
  data=Buffer.alloc(165);data.fill(1,0,32);data.fill(2,32,64);data.writeBigUInt64LE(50n,64);data[108]=1;owner=program;mutate();
  const r=await POST(new Request('https://offline.invalid/api/lp-holder-evidence',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({lpMint:mint})}));assert.equal(r.status,200,name);const b=await r.json();assert.equal(b.tokenAccountsDecoded,count,name);assert.equal(b.inventoryComplete,false);assert.equal(b.lpCustodyVerified,false);assert.equal(b.withdrawalRightsVerified,false);cases++;
 }
 assert.equal(calls,cases*3);console.log(`Compiled LP holder route: ${cases} no-network cases passed`);
}finally{global.fetch=original;}
