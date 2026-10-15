import test from 'node:test';
import assert from 'node:assert/strict';
import {investigateHolderSample} from './holderSampleInvestigation.mjs';
const holders=Array.from({length:25},(_,i)=>({wallet:'w'+i,balance:25-i}));
const snapshot={holders,circulatingSupply:1000};
test('defaults to top twenty and reports their share',async()=>{
 const queried=[];
 const result=await investigateHolderSample({rpcUrl:'https://example.org',snapshot,
  discover:async({wallet})=>{queried.push(wallet);return {edges:[],coverage:{decoded:0,historyComplete:false}};}});
 assert.equal(result.sampledWalletCount,20);
 assert.equal(result.top20TargetCount,20);
 assert.equal(result.top20HistoryCoverage,20);
 assert.equal(result.methodology,'TOP_20_HOLDER_INDEPENDENCE_V1');
 assert.ok(result.top20SupplyPct>0);
 assert.equal(queried.length,20);
});
test('failed holder investigation is not counted as successful coverage',async()=>{
 const result=await investigateHolderSample({rpcUrl:'https://example.org',snapshot,holderLimit:2,
  discover:async({wallet})=>{if(wallet==='w0')throw new Error('unavailable');return {edges:[],coverage:{decoded:1}};}});
 assert.equal(result.top20HistoryCoverage,1);
 assert.equal(result.sampledWalletCount,2);
});

test('top-20 offset selects only requested batch',async()=>{
 const queried=[];
 const r=await investigateHolderSample({rpcUrl:'https://example.org',snapshot,startIndex:5,batchSize:5,
  discover:async({wallet})=>{queried.push(wallet);return {edges:[],coverage:{decoded:0}};}});
 assert.deepEqual(queried,['w5','w6','w7','w8','w9']);
 assert.equal(r.sampledWalletCount,5);
 assert.equal(r.top20HistoryCoverage,5);
 assert.equal(r.startIndex,5);
});
