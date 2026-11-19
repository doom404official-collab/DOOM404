import test from "node:test";
import assert from "node:assert/strict";
import {processHolderScanJob} from "../lib/holderScanWorker.mjs";
test("claimed job is renewed and version-checked before commit",async()=>{
 const holders=Array.from({length:20},(_,i)=>({ownerWallet:"w"+i,tokenAccount:"a"+i,sharePct:1}));
 const checkpoint={version:1,mint:"mint",holders,signatures:{},edges:{},wallets:Object.fromEntries(holders.map(h=>[h.ownerWallet,{cursor:null,pages:0,signaturesSeen:0,exhausted:false}]))};
 const events=[];
 const store={
  claim:async()=>{events.push("claim");return {version:2,checkpoint};},
  renew:async(_id,_worker,version)=>{events.push("renew:"+version);return {version:3};},
  commit:async(_id,_worker,version,_cp,_summary,status)=>{events.push("commit:"+version);return {status,version:4,updated_at:"now"};}
 };
 const rpc=async()=>[];
 const result=await processHolderScanJob({store,jobId:"job",rpc,maxRequests:1});
 assert.equal(result.status,"partial");
 assert.deepEqual(events,["claim","renew:2","commit:3"]);
});
test("competing worker does not scan without claim",async()=>{
 let called=false;
 const result=await processHolderScanJob({store:{claim:async()=>null},jobId:"job",rpc:async()=>{called=true;}});
 assert.equal(result.status,"ALREADY_CLAIMED");
 assert.equal(called,false);
});
