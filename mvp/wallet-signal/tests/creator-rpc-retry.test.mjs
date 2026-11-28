import test from "node:test";
import assert from "node:assert/strict";
import { createSolanaRpcAdapter } from "../lib/creatorOriginRpc.mjs";
test("retries a 429 with Retry-After and succeeds within budget",async()=>{
  let calls=0; const waits=[];
  const rpc=createSolanaRpcAdapter({rpcUrl:"https://example.test/rpc",maxRequests:2,maxRetries:1,
    minIntervalMs:0,sleep:async ms=>{waits.push(ms);},
    fetchImpl:async()=>{calls++;return calls===1
      ? {ok:false,status:429,headers:{get:()=> "1"}}
      : {ok:true,status:200,json:async()=>({result:{slot:1}})};}});
  assert.deepEqual(await rpc.fetchTransaction("signature"),{slot:1});
  assert.equal(calls,2);assert.ok(waits.some(ms=>ms>=1000));
});
test("stops on repeated 429 without exceeding request budget",async()=>{
  let calls=0;
  const rpc=createSolanaRpcAdapter({rpcUrl:"https://example.test/rpc",maxRequests:2,maxRetries:2,
    minIntervalMs:0,sleep:async()=>{},fetchImpl:async()=>{calls++;return {ok:false,status:429,headers:{get:()=>null}};}});
  await assert.rejects(()=>rpc.fetchTransaction("signature"),/RPC_REQUEST_BUDGET_EXHAUSTED/);
  assert.equal(calls,2);
});
test("does not wait indefinitely for excessive Retry-After",async()=>{
  const rpc=createSolanaRpcAdapter({rpcUrl:"https://example.test/rpc",maxRetries:1,minIntervalMs:0,
    sleep:async()=>{throw Error("should not sleep");},
    fetchImpl:async()=>({ok:false,status:429,headers:{get:()=> "120"}})});
  await assert.rejects(()=>rpc.fetchTransaction("signature"),/RPC_RETRY_AFTER_TOO_LONG/);
});
