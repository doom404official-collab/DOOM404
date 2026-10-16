import test from 'node:test';
import assert from 'node:assert/strict';
import {createHolderHistoryCheckpoint} from '../lib/holderHistoryCheckpoint.mjs';
import {scanHolderHistoryBatch} from '../lib/holderHistoryEngine.mjs';
test('large backlog favors decoding but eventually paginates',async()=>{
 const holders=Array.from({length:2},(_,i)=>({ownerWallet:'wallet'+i,tokenAccount:'token'+i,sharePct:1}));
 const cp=createHolderHistoryCheckpoint({mint:'test-mint',holders});
 for(let i=0;i<250;i++)cp.signatures['sig'+i]='pending';
 const discoveries=[];
 for(let batch=0;batch<4;batch++){
  const r=await scanHolderHistoryBatch({checkpoint:cp,maxRequests:6,pageLimit:10,rpc:async(method)=>{
   if(method==='getSignaturesForAddress'){discoveries.push(batch);return [];}
   return null;
  }});
  assert.equal(r.summary.requestCount,6);
  assert.equal(r.summary.reason,null);
 }
 assert.deepEqual(discoveries,[3]);
 assert.equal(cp.decodeOnlyBatches,0);
});
