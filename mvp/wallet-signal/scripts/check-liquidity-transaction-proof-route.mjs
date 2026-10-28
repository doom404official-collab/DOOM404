// Actual compiled route, mocked JSON-RPC transport, outbound blocked by the caller.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
process.env.SOLANA_RPC_URL='https://offline.invalid';process.env.SOLANA_RPC_FALLBACK_URLS='';process.env.HELIUS_RPC_URL='';process.env.GLITCH_LIQUIDITY_HISTORY_RPC_URL='';
const {POST}=require('../.next/server/app/api/liquidity-transaction-evidence/route.js').routeModule.userland;
const signature='a'.repeat(64),pool='11111111111111111111111111111111';let current,calls=0;
const originalFetch=global.fetch;
global.fetch=async(url,options)=>{assert.equal(new URL(url).origin,'https://offline.invalid');const q=JSON.parse(options.body);let result;if(q.method==='getSignaturesForAddress')result=[{signature,slot:123,err:null,blockTime:1,memo:null}];else{assert.equal(q.method,'getTransaction');assert.equal(q.params[0],signature);calls++;result=current;}return Response.json({jsonrpc:'2.0',id:q.id,result});};
const tx=()=>({slot:123,transaction:{signatures:[signature],message:{accountKeys:[],instructions:[],header:{numRequiredSignatures:0,numReadonlySignedAccounts:0,numReadonlyUnsignedAccounts:0},recentBlockhash:'11111111111111111111111111111111'}},meta:{err:null,fee:0,innerInstructions:[],preBalances:[],postBalances:[]}});
try{
 let cases=0;
 for(const [name,mutate,expected] of [
  ['matched success remains candidate-only',()=>{},'candidate_only'],
  ['wrong signature',t=>t.transaction.signatures=['other'],'unavailable'],
  ['wrong-signature failure',t=>{t.transaction.signatures=['other'];t.meta.err='AccountNotFound';},'unavailable'],
  ['slot mismatch',t=>t.slot=124,'unavailable'],
  ['missing execution',t=>delete t.meta.err,'unavailable'],
  ['malformed execution',t=>t.meta.err={Invented:false},'unavailable'],
  ['proven failure',t=>t.meta.err='AccountNotFound','failed_execution']
 ]){
  current=tx();mutate(current);const result=await POST(new Request('https://offline.invalid/api/liquidity-transaction-evidence',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({poolAddress:pool})}));
  assert.equal(result.status,200);const body=await result.json();assert.equal(body.decodedTransactions[0].status,expected,name);assert.deepEqual(body.decodedTransactions[0].candidateOperations,[]);assert.equal(body.decodedTransactions[0].withdrawalConfirmed,false);assert.equal(body.classificationComplete,false);if(body.decodedTransactions[0].historicalFeeAuthorization)assert.equal(body.decodedTransactions[0].historicalFeeAuthorization.authorizationVerified,false);cases++;
 }
 assert.equal(calls,cases);console.log(`Compiled Liquidity proof route: ${cases} no-network cases passed`);
}finally{global.fetch=originalFetch;}
