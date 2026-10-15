import test from 'node:test';
import assert from 'node:assert/strict';
import {QUOTA_DOMAINS,planRpcCapacity} from './rpcQuotaDomains.mjs';
test('public scan admission is separate from historical worker quota',()=>{
 assert.notEqual(QUOTA_DOMAINS.publicAdmission,QUOTA_DOMAINS.historicalWorker);
});
test('historical-only workload retains provider capacity planning',()=>{
 const r=planRpcCapacity({providerRps:10,activeHistoricalWorkers:2});
 assert.equal(r.budgetRps,8);assert.equal(r.perWorkerRps,4);
});
test('adding customer workers shares RPC budget but does not change admission quota',()=>{
 const r=planRpcCapacity({providerRps:10,activeHistoricalWorkers:2,activeCustomerWorkers:2});
 assert.equal(r.budgetRps,8);assert.equal(r.perWorkerRps,2);
 assert.equal(QUOTA_DOMAINS.publicAdmission,'glitch_admit_deep_scan');
});
test('invalid provider capacity fails closed',()=>{
 assert.throws(()=>planRpcCapacity({providerRps:0}));
 assert.throws(()=>planRpcCapacity({providerRps:10,activeHistoricalWorkers:-1}));
});
