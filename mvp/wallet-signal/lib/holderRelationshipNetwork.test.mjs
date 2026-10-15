import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeHolderNetwork} from './holderRelationshipNetwork.mjs';
const a='11111111111111111111111111111111';
const b='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const c='TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const sig='1'.repeat(64);
const holders=[{wallet:a,balance:40},{wallet:b,balance:30},{wallet:c,balance:30}];
const edge=(from,to,assetType='SOL')=>({from,to,assetType,signature:sig,verifiedOnChain:true,transferVerified:true});
test('SOL transfers connect holders',()=>{
 const r=analyzeHolderNetwork({holders,transfers:[edge(a,b)]});
 assert.equal(r.directHolderCount,2);
 assert.equal(r.connectedHolderCount,2);
});
test('different token transfers establish same relationship',()=>{
 const r=analyzeHolderNetwork({holders,transfers:[edge(a,b,'SPL'),edge(b,c,'TOKEN_2022')]});
 assert.equal(r.connectedHolderCount,3);
 assert.equal(r.clusters.length,1);
});
test('creator-linked holder is distinguished',()=>{
 const r=analyzeHolderNetwork({holders,creatorWallets:[c],transfers:[edge(a,c)]});
 assert.equal(r.clusters.some(x=>x.creatorLinked && x.wallets.includes(a)),true);
});
test('infrastructure hubs do not falsely connect holders',()=>{
 const hub='SysvarRent111111111111111111111111111111111';
 const r=analyzeHolderNetwork({holders,infrastructureWallets:[hub],transfers:[edge(a,hub),edge(b,hub)]});
 assert.equal(r.connectedHolderCount,0);
});
test('unverified transactions do not establish links',()=>{
 const r=analyzeHolderNetwork({holders,transfers:[{...edge(a,b),verifiedOnChain:false}]});
 assert.equal(r.connectedHolderCount,0);
});
