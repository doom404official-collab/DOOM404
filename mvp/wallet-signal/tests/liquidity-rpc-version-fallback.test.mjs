import test from "node:test";
import assert from "node:assert/strict";
import {retrieveLiquidityTransaction} from "../lib/liquidityRpcVersionFallback.mjs";
test("uses primary when successful",async()=>{
 const r=await retrieveLiquidityTransaction("sig",{primaryConnection:{getTransaction:async()=>({version:0})},alternateUrl:"https://backup.example"});
 assert.equal(r.provider,"primary");assert.equal(r.fallbackUsed,false);
});
test("falls back only on RPC version rejection",async()=>{
 const primary={getTransaction:async()=>{throw Object.assign(new Error("unsupported"),{code:-32015});}};
 const r=await retrieveLiquidityTransaction("sig",{primaryConnection:primary,alternateUrl:"https://backup.example",connectionFactory:()=>({getTransaction:async()=>({version:0})})});
 assert.equal(r.provider,"helius_or_configured_alternate");assert.equal(r.fallbackUsed,true);
});
test("does not fall back on unrelated errors",async()=>{
 const primary={getTransaction:async()=>{throw Object.assign(new Error("rate limited"),{code:429});}};
 const r=await retrieveLiquidityTransaction("sig",{primaryConnection:primary,alternateUrl:"https://backup.example"});
 assert.equal(r.fallbackUsed,false);assert.ok(r.error);
});

test("does not retry identical RPC endpoint",async()=>{
 const primary={getTransaction:async()=>{throw Object.assign(new Error("unsupported"),{code:-32015});}};
 const r=await retrieveLiquidityTransaction("sig",{primaryConnection:primary,primaryUrl:"https://same.example",alternateUrl:"https://same.example"});
 assert.equal(r.fallbackUsed,false);assert.equal(r.fallbackSkipped,"SAME_RPC_ENDPOINT");
});
