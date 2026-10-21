import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const yaml=await readFile(new URL("../../../.github/workflows/glitch-liquidity-history-controlled-worker.yml",import.meta.url),"utf8");
test("controlled worker has no automatic schedule and is serialized",()=>{
 assert.match(yaml,/workflow_dispatch:/);
 assert.doesNotMatch(yaml,/^  schedule:/m);
 assert.match(yaml,/cancel-in-progress: false/);
});
test("worker enforces bounded retrieval and successor validation",()=>{
 assert.match(yaml,/GLITCH_HISTORY_BUDGET: '60'/);
 assert.match(yaml,/liquidity-select-checkpoint.mjs/);
 assert.match(yaml,/liquidity-historical-investigator.mjs/);
 assert.match(yaml,/liquidity-validate-successor.mjs/);
 assert.match(yaml,/steps.select.outputs.action == 'CONTINUE_BOUNDED'/);
});
