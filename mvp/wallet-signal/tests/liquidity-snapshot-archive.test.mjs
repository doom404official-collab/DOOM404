import test from "node:test";
import assert from "node:assert/strict";
import {appendLiquiditySnapshot} from "../lib/liquiditySnapshotArchive.mjs";
const evidence={mint:"98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump",status:"partial",observedAt:"2026-10-18T07:00:00Z",pools:[],batchErrors:[],finalScore:null,verifiedDepth:false,lpSecurityVerified:false};
test("appends snapshot without upsert",async()=>{
 let request;
 await appendLiquiditySnapshot(evidence,{url:"https://example.supabase.co",serviceRoleKey:"test",fetchImpl:async(url,options)=>{request={url,options};return {ok:true};}});
 assert.match(request.url,/liquidity_evidence_snapshots$/);
 assert.equal(request.options.method,"POST");
 assert.doesNotMatch(request.url,/on_conflict/);
 assert.equal(JSON.parse(request.options.body).evidence.finalScore,null);
});
test("rejects unavailable archive",async()=>{
 await assert.rejects(()=>appendLiquiditySnapshot(evidence,{url:"https://example.supabase.co",serviceRoleKey:"test",fetchImpl:async()=>({ok:false,status:503})}),/LIQUIDITY_SNAPSHOT_WRITE_FAILED_503/);
});
