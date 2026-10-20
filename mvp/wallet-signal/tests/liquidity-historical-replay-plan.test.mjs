import test from "node:test";
import assert from "node:assert/strict";
import {validateHistoryCheckpoint,HISTORY_CLASSIFICATION} from "../lib/liquidityHistoricalDecoder.mjs";
test("historical replay source retains pending authorization and original signatures",()=>{
 const original={schemaVersion:1,pool:"pool",before:"cursor",seen:["sig1","sig2"],events:[],pendingSignatures:["sig3"],classification:HISTORY_CLASSIFICATION,complete:false};
 const checked=validateHistoryCheckpoint(original,"pool");
 assert.deepEqual(checked.seen,["sig1","sig2"]);
 assert.deepEqual(checked.pendingSignatures,["sig3"]);
 assert.equal(checked.classification,HISTORY_CLASSIFICATION);
 assert.equal(checked.complete,false);
});
