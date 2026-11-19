import test from "node:test";
import assert from "node:assert/strict";
import {retryLiquidityRateLimit,isLiquidityRateLimit} from "../lib/liquidityHistoricalRateLimit.mjs";
test("429 retry succeeds after bounded backoff",async()=>{
 let attempts=0;const waits=[];
 const result=await retryLiquidityRateLimit(async()=>{if(++attempts<3)throw Error("RPC_HTTP_429");return "ok";},{sleep:async ms=>waits.push(ms)});
 assert.equal(result,"ok");assert.equal(attempts,3);assert.deepEqual(waits,[750,1500]);
});
test("429 stops after bounded retries",async()=>{
 let attempts=0;
 await assert.rejects(retryLiquidityRateLimit(async()=>{attempts++;throw Error("RPC_HTTP_429");},{sleep:async()=>{}}),/429/);
 assert.equal(attempts,3);
});
test("non-rate-limit errors are never retried",async()=>{
 let attempts=0;
 await assert.rejects(retryLiquidityRateLimit(async()=>{attempts++;throw Error("RPC_-32015");},{sleep:async()=>{}}),/32015/);
 assert.equal(attempts,1);
});
test("recognizes rate limit but not unrelated RPC error",()=>{
 assert.equal(isLiquidityRateLimit("Too many requests"),true);
 assert.equal(isLiquidityRateLimit("RPC_HTTP_401"),false);
});
