import test from "node:test";
import assert from "node:assert/strict";
import {retrieveHistoricalTransaction,isUnsupportedTransactionVersion} from "../lib/liquidityHistoricalTransactionCompat.mjs";
test("retry only explicit unsupported version and preserve bounded options",async()=>{
 const calls=[];
 const call=async(_url,_method,params)=>{calls.push(params[1].maxSupportedTransactionVersion);if(calls.length===1)throw Error("Unsupported transaction version");return {slot:123};};
 assert.deepEqual(await retrieveHistoricalTransaction(call,"https://rpc.invalid","sig"),{slot:123});
 assert.deepEqual(calls,[0,1]);
});
test("unrelated RPC errors do not trigger a version retry",async()=>{
 let calls=0;const call=async()=>{calls++;throw Error("RPC_HTTP_429");};
 await assert.rejects(retrieveHistoricalTransaction(call,"https://rpc.invalid","sig"),/429/);
 assert.equal(calls,1);
});
test("unknown errors cannot be misclassified as version incompatibility",()=>{
 assert.equal(isUnsupportedTransactionVersion("RPC_-32004"),false);
 assert.equal(isUnsupportedTransactionVersion("unsupported transaction version"),true);
});
