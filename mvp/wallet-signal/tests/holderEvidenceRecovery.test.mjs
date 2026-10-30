import test from "node:test";
import assert from "node:assert/strict";
import {processEvidenceBatch} from "../lib/holderEvidenceBatch.mjs";
const checkpoint={wallets:{"33333333333333333333333333333333":{},"44444444444444444444444444444444":{}},holders:[],edges:{"33333333333333333333333333333333|44444444444444444444444444444444":{walletA:"33333333333333333333333333333333",walletB:"44444444444444444444444444444444",signatures:["2222222222222222222222222222222222222222222222222222222222222222"]}}};
const tx={slot:12,meta:{err:null,innerInstructions:[]},transaction:{signatures:["2222222222222222222222222222222222222222222222222222222222222222"],message:{accountKeys:[],instructions:[{programId:"11111111111111111111111111111111",program:"system",parsed:{type:"transfer",info:{source:"33333333333333333333333333333333",destination:"44444444444444444444444444444444",lamports:100}}}]}}};
function store(overrides={}){
 const saved=[];
 return {saved,seed:async()=>0,claim:async()=>[{signature:"2222222222222222222222222222222222222222222222222222222222222222",attempts:0}],finish:async(_job,sig,_worker,result)=>{saved.push({sig,...result});return true;},...overrides};
}
test("successful transfer is persisted as verified",async()=>{
 const s=store();
 const r=await processEvidenceBatch({jobId:"test",checkpoint,store:s,rpc:async()=>tx});
 assert.equal(r.processed,1);
 assert.equal(s.saved[0].status,"verified");
 assert.deepEqual(s.saved[0].evidence.pairs,["33333333333333333333333333333333|44444444444444444444444444444444"]);
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

test("no claims are distinct from a lost lease, without inventing progress",async()=>{
 const idle=await processEvidenceBatch({jobId:"test",checkpoint,store:store({claim:async()=>[]}),rpc:()=>assert.fail("Unexpected RPC")});
 assert.equal(idle.claimed,0);assert.equal(idle.leaseLost,0);assert.equal(idle.processed,0);
 const lost=await processEvidenceBatch({jobId:"test",checkpoint,store:store({finish:async()=>false}),rpc:async()=>tx});
 assert.equal(lost.claimed,1);assert.equal(lost.leaseLost,1);assert.equal(lost.processed,0);
});
test("malformed seed, claims, and finish cannot fabricate validation progress",async()=>{
 for(const value of [null,{},true,"1",-1,0.5]){
  await assert.rejects(processEvidenceBatch({jobId:"test",checkpoint,store:store({seed:async()=>value}),rpc:()=>assert.fail("Unexpected RPC")}),{message:"EVIDENCE_SEED_INVALID_RESPONSE"});
 }
 const good={signature:"2222222222222222222222222222222222222222222222222222222222222222",attempts:0};
 for(const value of [null,{},[null],[{}],[{...good,signature:" "}],[{...good,attempts:-1}],[{...good,attempts:5}],
  [{...good,attempts:0.5}],[{...good,job_id:"other"}],[good,good],Array(7).fill(good)]){
  await assert.rejects(processEvidenceBatch({jobId:"test",checkpoint,store:store({claim:async()=>value}),rpc:()=>assert.fail("Unexpected RPC")}),{message:"EVIDENCE_CLAIM_INVALID_RESPONSE"});
 }
 for(const value of [null,{},[],"false",0,1]){
  await assert.rejects(processEvidenceBatch({jobId:"test",checkpoint,store:store({finish:async()=>value}),rpc:async()=>tx}),{message:"EVIDENCE_FINISH_INVALID_RESPONSE"});
 }
});

test("mixed successful and lost finishes report actual saved progress only",async()=>{
 const s=store({claim:async()=>[{signature:"2222222222222222222222222222222222222222222222222222222222222222",attempts:0},{signature:"3333333333333333333333333333333333333333333333333333333333333333",attempts:0}],finish:async(_id,signature)=>signature==="2222222222222222222222222222222222222222222222222222222222222222"});
 const r=await processEvidenceBatch({jobId:"test",checkpoint,store:s,rpc:async()=>tx});
 assert.equal(r.claimed,2);assert.equal(r.processed,1);assert.equal(r.leaseLost,1);
});
