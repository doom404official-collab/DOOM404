import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreTop20Network} from './top20NetworkScore.mjs';
const holders=Array.from({length:20},(_,i)=>({wallet:'w'+i,balance:1}));
const edge=(a,b,s)=>({from:a,to:b,signature:s,verifiedOnChain:true,transferVerified:true});
const base={holders,network:{connectedHolderCount:0},exposure:{largestClusterPct:0}};
test('no observed links retains all 35 observed-evidence points',()=>{
 const r=scoreTop20Network({...base,transfers:[]});
 assert.equal(r.score,35);
});
test('direct connections reduce independence points',()=>{
 const r=scoreTop20Network({...base,transfers:[edge('w0','w1','sig1')],network:{connectedHolderCount:2},exposure:{largestClusterPct:8}});
 assert.ok(r.score<35);assert.equal(r.evidence.directPairs,1);
});
test('repeated transactions have additional penalty without duplicate pair count',()=>{
 const single=scoreTop20Network({...base,transfers:[edge('w0','w1','sig1')],network:{connectedHolderCount:2},exposure:{largestClusterPct:8}});
 const repeated=scoreTop20Network({...base,transfers:[edge('w0','w1','sig1'),edge('w0','w1','sig2'),edge('w0','w1','sig3')],network:{connectedHolderCount:2},exposure:{largestClusterPct:8}});
 assert.equal(repeated.evidence.directPairs,1);assert.equal(repeated.evidence.repeatedPairs,1);
 assert.ok(repeated.score<single.score);
});
test('indirect relationships are counted separately from direct pairs',()=>{
 const r=scoreTop20Network({...base,transfers:[edge('w0','w1','sig1')],network:{connectedHolderCount:5},exposure:{largestClusterPct:15}});
 assert.equal(r.evidence.indirectHolders,3);
});
