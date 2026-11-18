import test from "node:test";
import assert from "node:assert/strict";
import {processEvidenceBatch} from "../lib/holderEvidenceBatch.mjs";
const signature="2".repeat(88);
test("evidence worker reuses one RPC response and retains fail-closed network extraction",async()=>{
 const saved=[];
 const store={seed:async()=>1,claim:async()=>[{signature,attempts:0}],finish:async(_job,_sig,_worker,data)=>{saved.push(data);return true}};
 let calls=0;
 const rpc=async()=>{calls++;return {slot:1,meta:{err:null,innerInstructions:[]},transaction:{signatures:[signature],message:{accountKeys:[],instructions:[]}}};};
 const result=await processEvidenceBatch({jobId:"job",checkpoint:{wallets:{},holders:[],edges:{}},store,rpc,limit:1});
 assert.equal(calls,1);assert.equal(result.processed,1);
 assert.equal(saved.length,1);
 assert.equal(saved[0].status,"rejected");
 assert.equal(saved[0].evidence.networkExtraction.valid,true);
 assert.deepEqual(saved[0].evidence.networkExtraction.transfers,[]);
});
test("missing transaction never claims network evidence",async()=>{
 const saved=[];
 const store={seed:async()=>1,claim:async()=>[{signature,attempts:0}],finish:async(_job,_sig,_worker,data)=>{saved.push(data);return true}};
 await processEvidenceBatch({jobId:"job",checkpoint:{wallets:{},holders:[],edges:{}},store,rpc:async()=>null,limit:1});
 assert.equal(saved[0].status,"unavailable");
 assert.equal(saved[0].evidence.networkExtraction,undefined);
});
