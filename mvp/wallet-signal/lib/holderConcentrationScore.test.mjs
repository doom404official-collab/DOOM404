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

test('concentrated supply scores lower than broadly distributed supply',()=>{
 const concentrated=[{wallet:'whale',balance:800},...Array.from({length:20},(_,i)=>({wallet:'small'+i,balance:10}))];
 const spread=Array.from({length:100},(_,i)=>({wallet:'diverse'+i,balance:10}));
 const a=scoreHolderConcentration({holders:concentrated,circulatingSupply:1000,investigationComplete:true});
 const b=scoreHolderConcentration({holders:spread,circulatingSupply:1000,investigationComplete:true});
 assert.ok(a.score<b.score);
});
test('verified infrastructure exclusion removes holdings from eligible top ten',()=>{
 const sample=[{wallet:'pool',balance:500},{wallet:'alice',balance:300},{wallet:'bob',balance:200}];
 const all=scoreHolderConcentration({holders:sample,circulatingSupply:1000,investigationComplete:true});
 const excluded=scoreHolderConcentration({holders:sample,circulatingSupply:1000,excludedWallets:['pool'],investigationComplete:true});
 assert.ok(excluded.metrics.top10Pct<all.metrics.top10Pct);
});
test('creator exposure reduces creator-team component',()=>{
 const baseline=scoreHolderConcentration({holders,circulatingSupply:1000,investigationComplete:true});
 const team=scoreHolderConcentration({holders,circulatingSupply:1000,creatorTeamWallets:holders.slice(0,20).map(h=>h.wallet),investigationComplete:true});
 assert.ok(team.components.creatorTeam<baseline.components.creatorTeam);
});
test('zero and negative supply rejected',()=>{
 assert.throws(()=>scoreHolderConcentration({holders,circulatingSupply:0}));
 assert.throws(()=>scoreHolderConcentration({holders,circulatingSupply:-1}));
});
