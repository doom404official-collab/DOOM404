import test from "node:test";
import assert from "node:assert/strict";
import {createHolderHistoryCheckpoint} from "../lib/holderHistoryCheckpoint.mjs";
import {scanHolderHistoryBatch} from "../lib/holderHistoryEngine.mjs";
test("unavailable historical transaction stays pending for future retries",async()=>{
 const holders=Array.from({length:20},(_,i)=>({ownerWallet:"wallet"+i,tokenAccount:"token"+i,sharePct:1}));
 const checkpoint=createHolderHistoryCheckpoint({mint:"test-mint",holders});
 checkpoint.signatures.sig="pending";
 const calls=[];
 const result=await scanHolderHistoryBatch({checkpoint,maxRequests:1,rpc:async(method)=>{
  calls.push(method);return null;
 }});
 assert.deepEqual(calls,["getTransaction"]);
 assert.equal(result.checkpoint.signatures.sig,"pending");
 assert.equal(result.summary.transactionsPending,1);
 assert.equal(result.summary.transactionsChecked,0);
 assert.equal(result.summary.reason,null);
 assert.equal(result.summary.decodeAttempts,1);
 assert.equal(result.summary.decodeSuccesses,0);
 assert.equal(result.summary.discoveryRequests,0);
});
