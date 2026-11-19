import test from "node:test";
import assert from "node:assert/strict";
import {comparePoolInventories} from "../lib/liquidityPoolContinuity.mjs";
test("reports retained, added and missing pools without risk claims",()=>{
 const result=comparePoolInventories(["A","B"],["B","C"]);
 assert.deepEqual(result.retained,["B"]);
 assert.deepEqual(result.newlyReported,["C"]);
 assert.deepEqual(result.missingFromCurrentReport,["A"]);
 assert.equal(result.completeOnChainInventory,false);
 assert.equal(result.missingPoolSafetyConclusion,null);
});
