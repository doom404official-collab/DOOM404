import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const script=readFileSync(new URL("../scripts/liquidity-evidence-worker.mjs",import.meta.url),"utf8");
const workflow=readFileSync(new URL("../../../.github/workflows/glitch-liquidity-evidence-worker.yml",import.meta.url),"utf8");
test("liquidity worker never invents verification or final score",()=>{
 assert.match(script,/verifiedDepth:false/);
 assert.match(script,/lpSecurityVerified:false/);
 assert.match(script,/finalScore:null/);
 assert.match(script,/poolInventoryComplete:false/);
});
test("liquidity worker caps batches and records errors",()=>{
 assert.match(script,/slice\(0,30\)/);
 assert.match(script,/i\+=5/);
 assert.match(script,/batchErrors/);
 assert.match(script,/writeFile/);
});
test("liquidity workflow is manual-only and branch-scoped",()=>{
 assert.match(workflow,/workflow_dispatch:/);
 assert.doesNotMatch(workflow,/^  schedule:/m);
 assert.match(workflow,/refs\/heads\/feature\/glitch-liquidity-evidence-worker/);
 assert.match(workflow,/upload-artifact@v4/);
});

test("liquidity worker requires durable checkpoint persistence",()=>{
 assert.match(script,/persistLiquidityCheckpoint/);
 assert.match(script,/LIQUIDITY_STORAGE_NOT_CONFIGURED/);
});

test("transaction discovery is limited to reserve movements and four pools",()=>{
 assert.match(script,/reserveHistoryComparison\.pools\.filter/);
 assert.match(script,/slice\(0,4\)/);
 assert.match(script,/liquidity-transaction-evidence/);
 assert.match(script,/evidence\.transactionEvidence/);
});
