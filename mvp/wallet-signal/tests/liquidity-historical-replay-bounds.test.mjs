import test from "node:test";
import assert from "node:assert/strict";
import {buildHistoricalReplayPlan} from "../lib/liquidityHistoricalReplayPlan.mjs";
import {HISTORY_CLASSIFICATION} from "../lib/liquidityHistoricalDecoder.mjs";
test("bounded replay plan preserves source and separates pending signatures",()=>{
 const checkpoint={schemaVersion:1,pool:"pool",before:"cursor",seen:["a","b","c"],events:[],pendingSignatures:["pending"],classification:HISTORY_CLASSIFICATION,complete:false};
 const before=JSON.stringify(checkpoint);
 const plan=buildHistoricalReplayPlan(checkpoint,{pool:"pool",maxSignatures:2});
 assert.deepEqual(plan.signaturesToReplay,["a","b"]);
 assert.deepEqual(plan.existingPendingSignatures,["pending"]);
 assert.equal(plan.remainingReplayCount,1);
 assert.equal(JSON.stringify(checkpoint),before);
 assert.equal(plan.authorizationVerified,false);
 assert.equal(plan.finalScore,null);
});
test("replay planning rejects mismatched pool and invalid limits",()=>{
 const checkpoint={schemaVersion:1,pool:"pool",seen:[],events:[],classification:HISTORY_CLASSIFICATION,complete:false};
 assert.throws(()=>buildHistoricalReplayPlan(checkpoint,{pool:"other"}));
 assert.throws(()=>buildHistoricalReplayPlan(checkpoint,{pool:"pool",maxSignatures:0}));
});
