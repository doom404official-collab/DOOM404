import test from "node:test";
import assert from "node:assert/strict";
import {validateHistoryCheckpoint,HISTORY_CLASSIFICATION} from "../lib/liquidityHistoricalDecoder.mjs";
test("pending-only recovery source preserves previously replayed signatures",()=>{
 const checkpoint={schemaVersion:1,pool:"pool",before:"cursor",seen:["completed1","completed2"],pendingSignatures:["pending1","pending2"],events:[],classification:HISTORY_CLASSIFICATION,complete:false};
 const original=JSON.stringify(checkpoint);
 const validated=validateHistoryCheckpoint(checkpoint,"pool");
 assert.deepEqual(validated.pendingSignatures,["pending1","pending2"]);
 assert.deepEqual(validated.seen,["completed1","completed2"]);
 assert.equal(JSON.stringify(checkpoint),original);
});
