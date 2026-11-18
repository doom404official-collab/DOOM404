import test from "node:test";
import assert from "node:assert/strict";
import {buildHistoricalReplayPlan} from "../lib/liquidityHistoricalReplayPlan.mjs";
import {verifyHistoricalReplaySource} from "../lib/liquidityHistoricalReplaySource.mjs";
import {HISTORY_CLASSIFICATION} from "../lib/liquidityHistoricalDecoder.mjs";
test("replay source must match exact original checkpoint digest",()=>{
 const checkpoint={schemaVersion:1,pool:"pool",seen:["signature"],events:[],pendingSignatures:[],classification:HISTORY_CLASSIFICATION,complete:false};
 const plan=buildHistoricalReplayPlan(checkpoint,{pool:"pool"});
 assert.equal(verifyHistoricalReplaySource(plan,checkpoint,"pool"),true);
 assert.throws(()=>verifyHistoricalReplaySource(plan,{...checkpoint,seen:["other"]},"pool"),/DIGEST/);
 assert.throws(()=>verifyHistoricalReplaySource(plan,checkpoint,"other"));
});
