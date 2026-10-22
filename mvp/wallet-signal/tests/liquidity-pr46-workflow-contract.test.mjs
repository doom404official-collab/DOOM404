import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const workflow=readFileSync(new URL('../../../.github/workflows/glitch-liquidity-history-controlled-worker.yml',import.meta.url),'utf8');
test('manual and branch gated',()=>{
 assert.ok(workflow.includes('workflow_dispatch:'));
 assert.ok(!workflow.includes('schedule:'));
 assert.ok(workflow.includes("GLITCH_HISTORY_BUDGET: '60'"));
 assert.ok(workflow.includes("refs/heads/feature/glitch-liquidity-evidence-worker"));
});
test('failure artifacts isolated from successful checkpoints',()=>{
 assert.ok(workflow.includes('liquidity-prepare-partial-recovery.mjs'));
 assert.ok(workflow.includes('liquidity-preserve-failure-diagnostic.mjs'));
 assert.ok(workflow.includes("steps.recovery.outcome == 'success'"));
 assert.ok(workflow.includes("steps.diagnostics.outcome == 'success'"));
 assert.ok(workflow.includes("steps.investigate.outcome == 'failure'"));
 assert.ok(workflow.includes('^liquidity-(reconciled|history)-[0-9]+$'));
 const discovery=/^liquidity-(reconciled|history)-[0-9]+$/;
 assert.equal(discovery.test('liquidity-history-partial-123'),false);
 assert.equal(discovery.test('liquidity-history-failure-123'),false);
});
