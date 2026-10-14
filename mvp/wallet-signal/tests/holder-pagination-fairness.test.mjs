import test from "node:test";
import assert from "node:assert/strict";
import {createHolderHistoryCheckpoint} from "../lib/holderHistoryCheckpoint.mjs";
import {scanHolderHistoryBatch} from "../lib/holderHistoryEngine.mjs";
test("pending unavailable transactions do not starve wallet pagination",async()=>{
 const holders=Array.from({length:20},(_,i)=>({ownerWallet:"wallet"+i,tokenAccount:"token"+i,sharePct:1}));
 const cp=createHolderHistoryCheckpoint({mint:"test-mint",holders});
 for(let i=0;i<20;i++)cp.signatures["sig"+i]="pending";
 const calls=[];
 const result=await scanHolderHistoryBatch({checkpoint:cp,maxRequests:6,rpc:async(method)=>{
  calls.push(method);return method==="getTransaction"?null:[];
 }});
 assert.ok(calls.includes("getSignaturesForAddress"));
 assert.equal(result.checkpoint.signatures.sig0,"pending");
 assert.ok(result.summary.scanCoverage.walletsWithPages>0);
});
