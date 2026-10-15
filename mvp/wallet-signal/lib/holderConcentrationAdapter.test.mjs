import test from 'node:test';
import assert from 'node:assert/strict';
import {assessHolderSnapshot} from './holderConcentrationAdapter.mjs';
const snapshot={slot:12345,complete:true,source:'fixture',circulatingSupply:100,
 holders:[{wallet:'a',balance:40},{wallet:'b',balance:30},{wallet:'c',balance:30}]};
test('valid snapshot produces provisional assessment with provenance',()=>{
 const r=assessHolderSnapshot({snapshot});
 assert.equal(r.status,'provisional');
 assert.equal(r.score,null);
 assert.equal(r.snapshotSlot,12345);
 assert.equal(r.dataProvenance,'fixture');
});
test('validated edges are merged and scored after investigation completion',()=>{
 const r=assessHolderSnapshot({snapshot,investigationComplete:true,transferEdges:[
  {from:'a',to:'b',verifiedTransfer:true,signature:'tx1',strength:'strong'},
  {from:'b',to:'c',verifiedTransfer:true,signature:'tx2',strength:'moderate'}
 ]});
 assert.equal(r.status,'final');
 assert.equal(r.clusterCount,1);
 assert.equal(r.metrics.maxVerifiedClusterPct,100);
});
test('incomplete holder snapshot cannot receive a score',()=>{
 const r=assessHolderSnapshot({snapshot:{...snapshot,complete:false},investigationComplete:true});
 assert.equal(r.status,'unavailable');
 assert.equal(r.score,null);
});
