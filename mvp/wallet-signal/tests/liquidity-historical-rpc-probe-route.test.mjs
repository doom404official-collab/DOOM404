import test from "node:test";
import assert from "node:assert/strict";
import {probeHistoricalAccountRpc} from "../lib/liquidityHistoricalRpcProbe.mjs";
test("historical RPC probe cannot verify unsupported historical account state",async()=>{
 const result=await probeHistoricalAccountRpc({rpcUrl:"https://rpc.example",account:"test",slot:458811200,fetchImpl:async()=>({ok:true,json:async()=>({result:{context:{slot:458811201},value:{}}})})});
 assert.equal(result.historicalStateVerified,false);
 assert.equal(result.status,"RESPONSE_UNVERIFIED");
});
