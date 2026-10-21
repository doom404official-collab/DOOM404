import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const source=await readFile(new URL("../scripts/liquidity-select-checkpoint.mjs",import.meta.url),"utf8");
test("checkpoint selector requires manifest, output and pool",()=>{
 assert.match(source,/MANIFEST_OUTPUT_POOL_REQUIRED/);
 assert.match(source,/INVALID_CHECKPOINT_MANIFEST/);
 assert.match(source,/selectLiquidityContinuationCheckpoint/);
 assert.match(source,/sourceRunId/);
});
