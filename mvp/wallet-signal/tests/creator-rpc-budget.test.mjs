import test from "node:test";
import assert from "node:assert/strict";
import { createSolanaRpcAdapter } from "../lib/creatorOriginRpc.mjs";
test("RPC adapter enforces total request budget",async()=>{
  let calls=0;
  const adapter=createSolanaRpcAdapter({rpcUrl:"https://example.test/rpc",maxRequests:1,
    fetchImpl:async()=>{calls++;return {ok:true,json:async()=>({result:null})};}});
  await adapter.fetchTransaction("sig1");
  await assert.rejects(()=>adapter.fetchTransaction("sig2"),/RPC_REQUEST_BUDGET_EXHAUSTED/);
  assert.equal(calls,1);
});
test("RPC adapter classifies HTTP 429 without exposing provider response",async()=>{
  const adapter=createSolanaRpcAdapter({rpcUrl:"https://example.test/rpc",
    fetchImpl:async()=>({ok:false,status:429})});
  await assert.rejects(()=>adapter.fetchTransaction("sig"),/RPC_RATE_LIMITED/);
});
