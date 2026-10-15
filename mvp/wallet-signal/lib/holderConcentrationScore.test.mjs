import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreHolderConcentration } from './holderConcentrationScore.mjs';
const holders = Array.from({length:100}, (_,i)=>({wallet:'w'+i,balance:10}));
test('final score is bounded and component weights sum to 100',()=>{
 const r=scoreHolderConcentration({holders,circulatingSupply:1000,investigationComplete:true});
 assert.equal(r.status,'final');
 assert.ok(r.score>=0 && r.score<=100);
 assert.equal(Object.values(r.components).reduce((a,b)=>a+b,0),r.score);
});
test('unfinished investigation does not claim a final score',()=>{
 const r=scoreHolderConcentration({holders,circulatingSupply:1000});
 assert.equal(r.score,null);
 assert.equal(r.components.connectedWallets,null);
 assert.equal(r.provisionalRange[1]-r.provisionalRange[0],35);
});
test('strong connected cluster increases risk',()=>{
 const base=scoreHolderConcentration({holders,circulatingSupply:1000,investigationComplete:true});
 const linked=scoreHolderConcentration({holders,circulatingSupply:1000,investigationComplete:true,
 connectedClusters:[{wallets:holders.slice(0,30).map(h=>h.wallet),strength:'strong'}]});
 assert.ok(linked.score<base.score);
});
test('weak transfer evidence is not treated as proven cluster',()=>{
 const r=scoreHolderConcentration({holders,circulatingSupply:1000,investigationComplete:true,
 connectedClusters:[{wallets:holders.slice(0,30).map(h=>h.wallet),strength:'weak'}]});
 assert.equal(r.metrics.maxVerifiedClusterPct,0);
});
test('duplicate holders and overlapping clusters are rejected',()=>{
 assert.throws(()=>scoreHolderConcentration({holders:[holders[0],holders[0]],circulatingSupply:1000}));
 assert.throws(()=>scoreHolderConcentration({holders,circulatingSupply:1000,
 connectedClusters:[{wallets:['w1'],strength:'strong'},{wallets:['w1'],strength:'moderate'}]}));
});
