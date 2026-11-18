import test from 'node:test';
import assert from 'node:assert/strict';
import {assessLiquidityCycleBudget as assess} from '../lib/liquidityAutoWorkerBudget.mjs';
test('60 request ceiling and exhaustion stop',()=>{
 assert.equal(assess({requestCount:0}).requestsRemaining,60);
 assert.equal(assess({requestCount:60}).action,'STOP_REQUEST_BUDGET');
 assert.throws(()=>assess({requestCount:61}),/BUDGET/);
});
test('concurrency and cycle limits fail closed',()=>{
 assert.throws(()=>assess({requestCount:1,activeWorkers:2}),/SINGLE_WORKER/);
 assert.throws(()=>assess({requestCount:1,activeWorkers:0}),/SINGLE_WORKER/);
 assert.throws(()=>assess({requestCount:1,cycleCount:2}),/SINGLE_CYCLE/);
 assert.throws(()=>assess({requestCount:1,limit:100}),/FIXED_BUDGET/);
});
