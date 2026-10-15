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
 const verifiedSnapshot={...snapshot,supplyDefinition:'verified-circulating-supply',supplyVerified:true,coverageVerified:true,exclusionsVerified:true};
 const r=assessHolderSnapshot({snapshot:verifiedSnapshot,investigationComplete:true,creatorTeamVerified:true,transferEdges:[
  {from:'a',to:'b',verifiedTransfer:true,signature:'tx1',strength:'strong'},
  {from:'b',to:'c',verifiedTransfer:true,signature:'tx2',strength:'moderate'}
 ]});
 assert.equal(r.status,'final');
 assert.equal(r.clusterCount,1);
 assert.equal(r.metrics.maxVerifiedClusterPct,100);
});
test('incomplete holder snapshot cannot receive a score',()=>{
 const r=assessHolderSnapshot({snapshot:{...snapshot,complete:false},investigationComplete:true,creatorTeamVerified:true});
 assert.equal(r.status,'unavailable');
 assert.equal(r.score,null);
});

test('raw mint supply cannot produce final score despite investigation flags',()=>{
 const r=assessHolderSnapshot({snapshot,investigationComplete:true,creatorTeamVerified:true});
 assert.equal(r.status,'provisional');
 assert.equal(r.score,null);
 assert.equal(r.verification.supplyVerified,false);
});

test('independently verified components survive overall verification gate',()=>{
 const r=assessHolderSnapshot({snapshot,investigationComplete:true,creatorTeamVerified:true,creatorTeamWallets:['a'],transferEdges:[
  {from:'a',to:'b',verifiedTransfer:true,signature:'tx1',strength:'strong'}
 ]});
 assert.equal(r.status,'provisional');
 assert.equal(r.score,null);
 assert.equal(r.metrics.creatorTeamPct,40);
 assert.equal(r.metrics.maxVerifiedClusterPct,70);
 assert.ok(r.components.creatorTeam!==null);
 assert.ok(r.components.connectedWallets!==null);
});
