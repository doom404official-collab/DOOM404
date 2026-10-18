import test from "node:test";
import assert from "node:assert/strict";
import { persistLiquidityCheckpoint } from "../lib/liquidityCheckpointStore.mjs";
const mint="98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump";
const evidence={mint,status:"partial",observedAt:"2026-10-18T00:00:00.000Z",providerReportedPools:2,pools:[],batchErrors:[{startIndex:0,count:2,error:"unavailable"}],verifiedDepth:false,lpSecurityVerified:false,finalScore:null};
test("persists conservative evidence with conflict upsert",async()=>{
 let request;
 await persistLiquidityCheckpoint(evidence,{url:"https://example.supabase.co",serviceRoleKey:"test-only",fetchImpl:async(url,options)=>{request={url,options};return {ok:true,status:201};}});
 assert.match(request.url,/liquidity_evidence_checkpoints\?on_conflict=mint/);
 const row=JSON.parse(request.options.body);
 assert.equal(row.status,"partial");
 assert.equal(row.checked_pool_count,0);
 assert.equal(row.evidence.finalScore,null);
});
test("rejects unverified scoring claims",async()=>{
 await assert.rejects(()=>persistLiquidityCheckpoint({...evidence,finalScore:90},{url:"https://example.supabase.co",serviceRoleKey:"test-only",fetchImpl:async()=>({ok:true})}),/UNVERIFIED_LIQUIDITY_SCORE/);
});
test("fails closed when storage is unavailable",async()=>{
 await assert.rejects(()=>persistLiquidityCheckpoint(evidence,{url:"https://example.supabase.co",serviceRoleKey:"test-only",fetchImpl:async()=>({ok:false,status:503})}),/LIQUIDITY_CHECKPOINT_WRITE_FAILED_503/);
});
