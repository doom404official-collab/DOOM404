import test from "node:test";
import assert from "node:assert/strict";
import {readLiquidityCheckpoint} from "../lib/liquidityCheckpointReader.mjs";
test("reads previous evidence",async()=>{
 const result=await readLiquidityCheckpoint("mint",{url:"https://example.supabase.co",serviceRoleKey:"test",fetchImpl:async()=>({ok:true,json:async()=>[{evidence:{pools:[{pairAddress:"pool"}]}}]})});
 assert.equal(result.pools[0].pairAddress,"pool");
});
test("returns null if no previous checkpoint",async()=>{
 const result=await readLiquidityCheckpoint("mint",{url:"https://example.supabase.co",serviceRoleKey:"test",fetchImpl:async()=>({ok:true,json:async()=>[]})});
 assert.equal(result,null);
});
test("rejects failed storage read",async()=>{
 await assert.rejects(()=>readLiquidityCheckpoint("mint",{url:"https://example.supabase.co",serviceRoleKey:"test",fetchImpl:async()=>({ok:false,status:503})}),/LIQUIDITY_CHECKPOINT_READ_FAILED_503/);
});
