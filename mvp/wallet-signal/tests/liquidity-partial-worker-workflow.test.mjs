import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const yaml=await readFile(new URL("../../../.github/workflows/glitch-liquidity-history-controlled-worker.yml",import.meta.url),"utf8");
test("failed investigation preserves isolated partial evidence and diagnostic",()=>{
 assert.match(yaml,/liquidity-prepare-partial-recovery\.mjs/);
 assert.match(yaml,/liquidity-history-partial-\$\{\{ github\.run_id \}\}/);
 assert.match(yaml,/steps\.recovery\.outcome == 'success'/);
 assert.match(yaml,/liquidity-preserve-failure-diagnostic\.mjs/);
 assert.match(yaml,/liquidity-history-failure-\$\{\{ github\.run_id \}\}/);
});
