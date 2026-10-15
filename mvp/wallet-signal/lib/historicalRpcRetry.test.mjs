import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverSolRelationships} from './historicalSolRelationships.mjs';
const wallet='11111111111111111111111111111111';
const sig='1'.repeat(64);
test('retries 429 and records rate limits without duplicating transfers',async()=>{
 let attempts=0;
 const connection={
  getSignaturesForAddress:async()=>[{signature:sig,err:null}],
  getParsedTransaction:async()=>{
   attempts++;
   if(attempts<3)throw new Error('429 Too Many Requests');
   return {slot:10,meta:{err:null},transaction:{message:{instructions:[]}}};
  }
 };
 const r=await discoverSolRelationships({rpcUrl:'https://example.org',wallet,limit:2,
  connectionFactory:()=>connection,sleep:async()=>{}});
 assert.equal(r.coverage.rateLimitedCount,2);
 assert.equal(r.coverage.decoded,1);
 assert.equal(r.coverage.failed,0);
 assert.equal(attempts,3);
});
test('permanently unavailable transaction counted as failed',async()=>{
 const connection={getSignaturesForAddress:async()=>[{signature:sig,err:null}],
  getParsedTransaction:async()=>{throw new Error('RPC unavailable');}};
 const r=await discoverSolRelationships({rpcUrl:'https://example.org',wallet,limit:2,
  connectionFactory:()=>connection,sleep:async()=>{}});
 assert.equal(r.coverage.failed,1);
 assert.equal(r.coverage.decoded,0);
});
