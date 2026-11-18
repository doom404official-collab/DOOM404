import test from "node:test";
import assert from "node:assert/strict";
import {processHolderScanJob} from "../lib/holderScanWorker.mjs";
import {createHolderHistoryCheckpoint} from "../lib/holderHistoryCheckpoint.mjs";
test("bounded batch persists checkpoint after atomic claim and renewal",async()=>{
 const holders=Array.from({length:20},(_,i)=>({ownerWallet:"wallet"+i,tokenAccount:"token"+i,sharePct:1}));
 const cp=createHolderHistoryCheckpoint({mint:"test-mint",holders});
 const events=[];
 const store={
  claim:async()=>{events.push("claim");return {version:1,checkpoint:cp};},
  renew:async(_id,_worker,v)=>{events.push("renew:"+v);return {version:2};},
  commit:async(_id,_worker,v,checkpoint,summary,status)=>{
   events.push("commit:"+v);
   assert.equal(checkpoint.mint,"test-mint");
   assert.equal(status,"partial");
   assert.equal(summary.requestCount,1);
   return {status,version:3,updated_at:"2026-10-14T00:00:00Z"};
  }
 };
 const result=await processHolderScanJob({store,jobId:"test-job",rpc:async()=>[],maxRequests:1});
 assert.equal(result.status,"partial");
 assert.deepEqual(events,["claim","renew:1","commit:2"]);
});
test("no claim means no RPC requests",async()=>{
 let called=false;
 const result=await processHolderScanJob({store:{claim:async()=>null},jobId:"test-job",rpc:async()=>{called=true;}});
 assert.equal(result.status,"ALREADY_CLAIMED");
 assert.equal(called,false);
});
