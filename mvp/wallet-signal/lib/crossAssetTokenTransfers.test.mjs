import test from 'node:test';
import assert from 'node:assert/strict';
import {extractCrossAssetTokenTransfers} from './crossAssetTokenTransfers.mjs';
const a='11111111111111111111111111111111';
const b='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const mint='TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const sig='1'.repeat(64);
const tx={slot:100,meta:{err:null,preTokenBalances:[
 {accountIndex:0,owner:a,mint},{accountIndex:1,owner:b,mint}
 ]},transaction:{message:{accountKeys:[a,b],instructions:[{program:'spl-token',parsed:{type:'transferChecked',info:{source:a,destination:b,mint}}}]}}};
test('owner-resolved SPL transfer produces cross-asset edge',()=>{
 const r=extractCrossAssetTokenTransfers(tx,{signature:sig,wallet:a});
 assert.equal(r.length,1);assert.equal(r[0].from,a);assert.equal(r[0].to,b);
 assert.equal(r[0].assetType,'SPL');
});
test('unresolved ownership does not create an edge',()=>{
 const r=extractCrossAssetTokenTransfers({...tx,meta:{err:null}},{signature:sig,wallet:a});
 assert.equal(r.length,0);
});
test('failed transaction cannot establish relationship',()=>{
 assert.deepEqual(extractCrossAssetTokenTransfers({...tx,meta:{...tx.meta,err:{InstructionError:[0,'Custom']}}},{signature:sig}),[]);
});
