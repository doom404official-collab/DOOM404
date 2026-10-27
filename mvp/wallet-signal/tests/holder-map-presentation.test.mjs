import test from 'node:test';
import assert from 'node:assert/strict';
import {buildHolderMapPresentation as build} from '../lib/holderMapPresentation.mjs';
const a='3'.repeat(32),b='4'.repeat(32),s='2'.repeat(64),t='3'.repeat(64);
const holders=[{ownerWallet:a,sharePct:1},{ownerWallet:b,sharePct:null}],groups=[{directEdges:[{walletA:a,walletB:b,signatures:[s,t,s,'bad']}]}];
test('signature-level verification cannot promote every reference on a pair',()=>{
 const r=build(holders,groups,[{walletA:b,walletB:a,signatures:[s,'4'.repeat(64)]}]);
 assert.deepEqual(r.edges[0].signatures,[s,t]);assert.deepEqual(r.edges[0].verifiedSignatures,[s]);assert.equal(r.nodes[1].sharePct,null);
});
test('missing proof is not verified and duplicate-owner observed balances are aggregated',()=>{
 const r=build([...holders,{ownerWallet:a,sharePct:2}],groups,[{walletA:a,walletB:b}]);assert.equal(r.nodes[0].sharePct,3);assert.deepEqual(r.edges[0].verifiedSignatures,[]);
});
test('missing/malformed collections and shares remain unknown without mutation',()=>{
 assert.deepEqual(build(null,{},null),{nodes:[],edges:[]});const before=JSON.stringify({holders,groups});build(holders,groups);assert.equal(JSON.stringify({holders,groups}),before);
 for(const sharePct of [undefined,null,'1',NaN,-1])assert.equal(build([{ownerWallet:a,sharePct}]).nodes[0].sharePct,null);
});
