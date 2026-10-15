import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreHolderConcentration } from './holderConcentrationScore.mjs';
const holders = Array.from({length:100}, (_,i)=>({wallet:'w'+i,balance:10}));
test('final score is bounded and component weights sum to 100',()=>{
 const r=scoreHolderConcentration({holders,circulatingSupply:1000,investigationComplete:true,creatorTeamVerified:true});
 assert.equal(r.status,'final');
 assert.ok(r.score>=0 && r.score<=100);
 assert.ok(Math.abs(Object.values(r.components).reduce((a,b)=>a+b,0)-r.score)<1e-8);
});
test('unfinished investigation does not claim a final score',()=>{
 const r=scoreHolderConcentration({holders,circulatingSupply:1000});
 assert.equal(r.score,null);
 assert.equal(r.components.connectedWallets,null);
 assert.ok(Math.abs((r.provisionalRange[1]-r.provisionalRange[0])-55)<1e-8);
});
test('strong connected cluster increases risk',()=>{
 const base=scoreHolderConcentration({holders,circulatingSupply:1000,investigationComplete:true,creatorTeamVerified:true});
 const linked=scoreHolderConcentration({holders,circulatingSupply:1000,investigationComplete:true,creatorTeamVerified:true,
 connectedClusters:[{wallets:holders.slice(0,30).map(h=>h.wallet),strength:'strong'}]});
 assert.ok(linked.score<base.score);
});
test('weak transfer evidence is not treated as proven cluster',()=>{
 const r=scoreHolderConcentration({holders,circulatingSupply:1000,investigationComplete:true,creatorTeamVerified:true,
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
 const a=scoreHolderConcentration({holders:concentrated,circulatingSupply:1000,investigationComplete:true,creatorTeamVerified:true});
 const b=scoreHolderConcentration({holders:spread,circulatingSupply:1000,investigationComplete:true,creatorTeamVerified:true});
 assert.ok(a.score<b.score);
});
test('verified infrastructure exclusion removes holdings from eligible top ten',()=>{
 const sample=[{wallet:'pool',balance:500},{wallet:'alice',balance:300},{wallet:'bob',balance:200}];
 const all=scoreHolderConcentration({holders:sample,circulatingSupply:1000,investigationComplete:true,creatorTeamVerified:true});
 const excluded=scoreHolderConcentration({holders:sample,circulatingSupply:1000,excludedWallets:['pool'],investigationComplete:true,creatorTeamVerified:true});
 assert.ok(excluded.metrics.top10Pct<all.metrics.top10Pct);
});
test('creator exposure reduces creator-team component',()=>{
 const baseline=scoreHolderConcentration({holders,circulatingSupply:1000,investigationComplete:true,creatorTeamVerified:true});
 const team=scoreHolderConcentration({holders,circulatingSupply:1000,creatorTeamWallets:holders.slice(0,20).map(h=>h.wallet),investigationComplete:true,creatorTeamVerified:true});
 assert.ok(team.components.creatorTeam<baseline.components.creatorTeam);
});
test('zero and negative supply rejected',()=>{
 assert.throws(()=>scoreHolderConcentration({holders,circulatingSupply:0}));
 assert.throws(()=>scoreHolderConcentration({holders,circulatingSupply:-1}));
});

test('unknown creator attribution is not awarded 20 points',()=>{
 const r=scoreHolderConcentration({holders,circulatingSupply:1000,investigationComplete:true});
 assert.equal(r.status,'provisional');
 assert.equal(r.score,null);
 assert.equal(r.components.creatorTeam,null);
 assert.equal(r.metrics.creatorTeamPct,null);
 assert.ok(Math.abs(r.provisionalRange[1]-r.provisionalRange[0]-20)<1e-8);
});
