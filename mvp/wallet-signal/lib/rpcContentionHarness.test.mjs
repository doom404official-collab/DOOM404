import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateRpcContention} from './rpcContentionHarness.mjs';
test('concurrent workloads share one finite reservation budget',async()=>{
 let remaining=25;
 const r=await simulateRpcContention({workers:5,requestsPerWorker:20,
  reserve:async()=>remaining-->0});
 assert.equal(r.attempted,100);assert.equal(r.granted,25);assert.equal(r.denied,75);
});
test('no limit on historical pagination is imposed by the harness',async()=>{
 const r=await simulateRpcContention({workers:2,requestsPerWorker:100,reserve:async()=>true});
 assert.equal(r.granted,200);
});
