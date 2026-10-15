import test from 'node:test';
import assert from 'node:assert/strict';
import {consolidateTop20} from './consolidateTop20.mjs';
const holders=Array.from({length:20},(_,i)=>({wallet:'holder'+i,balance:20-i,rank:i+1}));
const batches=[0,5,10,15].map(start_index=>({start_index,status:'partial',wallet_results:holders.slice(start_index,start_index+5).map(h=>({wallet:h.wallet,edges:[],coverage:{decoded:8,failed:2,skippedFailed:1,historyComplete:false}}))}));
const snapshot={id:'a'.repeat(64),snapshot_slot:10,supply_raw:'1000',holder_ranking:holders};
test('unknown creator is not falsely reported as zero exposure',()=>{
 const r=consolidateTop20({snapshot,batches});
 assert.equal(r.exposure.creatorLinkedSupplyPct,null);
 assert.equal(r.creatorAttributionStatus,'not_verified');
});
test('historical coverage is explicit alongside observed network score',()=>{
 const r=consolidateTop20({snapshot,batches});
 assert.equal(r.evidenceCoverage.decodedTransactions,160);
 assert.equal(r.evidenceCoverage.decodeFailures,40);
 assert.equal(r.evidenceCoverage.unsuccessfulOnChainTransactions,20);
 assert.equal(r.networkScore.maxScore,35);
});
