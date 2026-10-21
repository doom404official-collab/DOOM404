import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const code=await readFile(new URL("../scripts/liquidity-validate-successor.mjs",import.meta.url),"utf8");
test("successor requires strict progress, no score, and matching source",()=>{
 assert.match(code,/HISTORY_SIGNATURE_REGRESSION/);
 assert.match(code,/HISTORY_RECONCILIATION_DRIFT/);
 assert.match(code,/HISTORY_NO_PROGRESS_MANUAL_REVIEW/);
 assert.match(code,/assessAutomaticHistoryCheckpoint\(next,pool\)/);
});
