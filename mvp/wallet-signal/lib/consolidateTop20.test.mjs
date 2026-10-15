import test from 'node:test';
import assert from 'node:assert/strict';
import {consolidateTop20} from './consolidateTop20.mjs';
const holders=Array.from({length:20},(_,i)=>({wallet:'holder'+i,balance:100-i,rank:i+1}));
const batches=[0,5,10,15].map(start_index=>({start_index,status:'partial',wallet_results:holders.slice(start_index,start_index+5).map(h=>({wallet:h.wallet,edges:[],coverage:{decoded:0,failed:0}}))}));
const snapshot={id:'a'.repeat(64),snapshot_slot:100,supply_raw:'10000',holder_ranking:holders};
test('explicit infrastructure exclusion removes wallet from scoring',()=>{
 const r=consolidateTop20({snapshot,batches,infrastructureWallets:['holder10']});
 assert.equal(r.eligibleHoldersScored,19);
 assert.equal(r.excludedInfrastructureWalletCount,1);
 assert.equal(r.networkScore.maxScore,35);
});
test('without verified exclusion all 20 frozen holders remain eligible',()=>{
 const r=consolidateTop20({snapshot,batches});
 assert.equal(r.eligibleHoldersScored,20);
 assert.equal(r.excludedInfrastructureWalletCount,0);
});
