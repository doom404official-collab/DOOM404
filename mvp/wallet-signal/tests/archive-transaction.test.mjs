import test from "node:test";
import assert from "node:assert/strict";
import { fetchArchivedTransaction } from "../lib/archiveTransaction.js";
const signature="3".repeat(88);
const endpoint="https://example.org/rpc";
test("rejects invalid signatures before making requests",async()=>{
 let calls=0;
 const out=await fetchArchivedTransaction("bad",{endpoint,fetchImpl:async()=>{calls++;}});
 assert.equal(out.status,"invalid_signature");
 assert.equal(calls,0);
});
test("requires a configured secure endpoint",async()=>{
 assert.equal((await fetchArchivedTransaction(signature)).status,"not_configured");
});
test("validates returned signature and successful transaction",async()=>{
 const fetchImpl=async()=>({ok:true,json:async()=>({result:{meta:{err:null},transaction:{signatures:[signature],message:{instructions:[]}}}})});
 assert.equal((await fetchArchivedTransaction(signature,{endpoint,fetchImpl})).status,"transaction_retrieved");
 const mismatch=async()=>({ok:true,json:async()=>({result:{meta:{err:null},transaction:{signatures:["other"],message:{instructions:[]}}}})});
 assert.equal((await fetchArchivedTransaction(signature,{endpoint,fetchImpl:mismatch})).status,"invalid_transaction_response");
});
test("does not turn provider failures into creator claims",async()=>{
 const result=await fetchArchivedTransaction(signature,{endpoint,fetchImpl:async()=>({ok:false,status:429})});
 assert.equal(result.status,"provider_error");
});
