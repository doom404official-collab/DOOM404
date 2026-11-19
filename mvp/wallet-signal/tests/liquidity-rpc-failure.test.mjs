import test from "node:test";
import assert from "node:assert/strict";
import {classifyLiquidityRpcFailure} from "../lib/liquidityRpcFailure.mjs";
test("classifies common RPC failures without exposing messages",()=>{
 assert.equal(classifyLiquidityRpcFailure(new Error("HTTP 429")),"RATE_LIMITED");
 assert.equal(classifyLiquidityRpcFailure(new Error("request timeout")),"TIMEOUT");
 assert.equal(classifyLiquidityRpcFailure(new Error("unsupported transaction version")),"UNSUPPORTED_VERSION");
 assert.equal(classifyLiquidityRpcFailure(new Error("private provider detail")),"RPC_RETRIEVAL_ERROR");
});

test("distinguishes client decoding from explicit version rejection",()=>{
 assert.equal(classifyLiquidityRpcFailure(new Error("Invalid transaction version format")),"CLIENT_DECODE_ERROR");
 assert.equal(classifyLiquidityRpcFailure(new Error("unsupported transaction version 1")),"UNSUPPORTED_VERSION");
});
