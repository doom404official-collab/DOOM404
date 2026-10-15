import test from "node:test";
import assert from "node:assert/strict";
import {processEvidenceBatch} from "../lib/holderEvidenceBatch.mjs";
const checkpoint={wallets:{walletA:{},walletB:{}},holders:[],edges:{"walletA|walletB":{walletA:"walletA",walletB:"walletB",signatures:["sig1"]}}};
const tx={slot:12,meta:{err:null,innerInstructions:[]},transaction:{message:{instructions:[{program:"system",parsed:{type:"transfer",info:{source:"walletA",destination:"walletB",lamports:100}}}]}}};
function store(overrides={}){
 const saved=[];
 return {saved,seed:async()=>0,claim:async()=>[{signature:"sig1",attempts:0}],finish:async(_job,sig,_worker,result)=>{saved.push({sig,...result});return true;},...overrides};
}
test("successful transfer is persisted as verified",async()=>{
 const s=store();
 const r=await processEvidenceBatch({jobId:"test",checkpoint,store:s,rpc:async()=>tx});
 assert.equal(r.processed,1);
 assert.equal(s.saved[0].status,"verified");
 assert.deepEqual(s.saved[0].evidence.pairs,["walletA|walletB"]);
});
test("transient RPC failure remains retryable",async()=>{
 const s=store();
 await processEvidenceBatch({jobId:"test",checkpoint,store:s,rpc:async()=>{throw Error("rate limit");}});
 assert.equal(s.saved[0].status,"unavailable");
 assert.equal(s.saved[0].attempts,1);
});
test("claim failures return safe stage-specific error",async()=>{
 const s=store({claim:async()=>{throw Error("private details");}});
 await assert.rejects(processEvidenceBatch({jobId:"test",checkpoint,store:s,rpc:async()=>tx}),{message:"EVIDENCE_CLAIM_FAILED"});
});
test("empty queue performs no RPC calls",async()=>{
 const s=store({claim:async()=>[]});
 const r=await processEvidenceBatch({jobId:"test",checkpoint,store:s,rpc:async()=>{throw Error("unexpected RPC");}});
 assert.equal(r.processed,0);
});
test("lease lost does not count as processed",async()=>{
 const s=store({finish:async()=>false});
 const r=await processEvidenceBatch({jobId:"test",checkpoint,store:s,rpc:async()=>tx});
 assert.equal(r.processed,0);
});
