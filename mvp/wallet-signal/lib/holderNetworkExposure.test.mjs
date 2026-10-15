import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeHolderNetworkExposure} from './holderNetworkExposure.mjs';
const holders=[{wallet:'a',balance:40},{wallet:'b',balance:30},{wallet:'c',balance:20},{wallet:'d',balance:10}];
test('connected supply and creator-linked exposure use holder balances',()=>{
 const r=summarizeHolderNetworkExposure({holders,circulatingSupply:100,network:{clusters:[
  {wallets:['a','b'],creatorLinked:true},{wallets:['c'],creatorLinked:false}
 ]}});
 assert.equal(r.connectedSupplyPct,90);
 assert.equal(r.creatorLinkedSupplyPct,70);
 assert.equal(r.largestClusterPct,70);
 assert.equal(r.connectedHolderCount,3);
});
test('overlapping clusters are rejected',()=>{
 assert.throws(()=>summarizeHolderNetworkExposure({holders,circulatingSupply:100,network:{clusters:[
  {wallets:['a','b']},{wallets:['b','c']}
 ]}}));
});
test('no connections produces zero observed network exposure',()=>{
 const r=summarizeHolderNetworkExposure({holders,circulatingSupply:100,network:{clusters:[]}});
 assert.equal(r.connectedSupplyPct,0);
 assert.equal(r.creatorLinkedSupplyPct,0);
});
