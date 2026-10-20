import test from "node:test";
import assert from "node:assert/strict";
import {probeHistoricalAccountRpc} from "../lib/liquidityHistoricalRpcProbe.mjs";
test("successful RPC response does not prove historical slot",async()=>{
 const r=await probeHistoricalAccountRpc({rpcUrl:"https://rpc.example",account:"test",slot:458811200,fetchImpl:async()=>({ok:true,json:async()=>({result:{context:{slot:459000000},value:{data:["","base64"]}}})})});
 assert.equal(r.status,"RESPONSE_UNVERIFIED");
 assert.equal(r.historicalStateVerified,false);
});
test("RPC error remains unverified",async()=>{
 const r=await probeHistoricalAccountRpc({rpcUrl:"https://rpc.example",account:"test",slot:458811200,fetchImpl:async()=>({ok:true,json:async()=>({error:{code:-32602,message:"Invalid params"}})})});
 assert.equal(r.status,"RPC_ERROR");
 assert.equal(r.historicalStateVerified,false);
});
