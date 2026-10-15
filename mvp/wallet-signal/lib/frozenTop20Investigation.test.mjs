import test from 'node:test';
import assert from 'node:assert/strict';
import {freezeTop20Snapshot,mergeInvestigationBatch} from './frozenTop20Investigation.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const snapshot={slot:100,circulatingSupply:1000,holders:[
 {wallet:'b',balance:20},{wallet:'a',balance:20},{wallet:'burn',balance:100},{wallet:'c',balance:10}]};
test('freeze creates stable rank and excludes specified infrastructure',()=>{
 const a=freezeTop20Snapshot({mint,snapshot,excludedWallets:['burn']});
 const b=freezeTop20Snapshot({mint,snapshot,excludedWallets:['burn']});
 assert.equal(a.id,b.id);
 assert.deepEqual(a.holders.map(h=>h.wallet),['a','b','c']);
});
test('merge rejects wrong snapshot and repeated batch',()=>{
 const state=freezeTop20Snapshot({mint,snapshot,excludedWallets:['burn']});
 assert.throws(()=>mergeInvestigationBatch(state,{snapshotId:'wrong',startIndex:0,results:[]}));
 const next=mergeInvestigationBatch(state,{snapshotId:state.id,startIndex:0,results:[{wallet:'a'}]});
 assert.equal(next.processed,1);
 assert.throws(()=>mergeInvestigationBatch(next,{snapshotId:state.id,startIndex:0,results:[{wallet:'a'}]}));
});
test('merge rejects changed wallet ranking',()=>{
 const state=freezeTop20Snapshot({mint,snapshot,excludedWallets:['burn']});
 assert.throws(()=>mergeInvestigationBatch(state,{snapshotId:state.id,startIndex:0,results:[{wallet:'b'}]}));
});
