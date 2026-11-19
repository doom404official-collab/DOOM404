import test from "node:test";
import assert from "node:assert/strict";
import {buildHistoricalReplayPlan} from "../lib/liquidityHistoricalReplayPlan.mjs";
import {HISTORY_CLASSIFICATION} from "../lib/liquidityHistoricalDecoder.mjs";
test("replay plan does not overwrite source checkpoint",()=>{
 const source={schemaVersion:1,pool:"pool",seen:["s1","s2"],events:[],pendingSignatures:["s3"],classification:HISTORY_CLASSIFICATION,complete:false};
 const snapshot=structuredClone(source);
 const plan=buildHistoricalReplayPlan(source,{pool:"pool",maxSignatures:1});
 assert.deepEqual(source,snapshot);
 assert.deepEqual(plan.signaturesToReplay,["s1"]);
 assert.deepEqual(plan.existingPendingSignatures,["s3"]);
 assert.equal(plan.requiresExplicitReplay,true);
 assert.equal(plan.authorizationVerified,false);
});
