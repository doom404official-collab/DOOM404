import test from 'node:test';
import assert from 'node:assert/strict';
import {buildEvidenceClusters,validateHolderSnapshot} from './concentrationEvidence.mjs';
test('overlapping verified transfers merge without duplicated wallets',()=>{
 const clusters=buildEvidenceClusters([
  {from:'a',to:'b',strength:'strong',verifiedTransfer:true,signature:'tx1'},
  {from:'b',to:'c',strength:'moderate',verifiedTransfer:true,signature:'tx2'}
 ]);
 assert.deepEqual(clusters,[{wallets:['a','b','c'],strength:'moderate'}]);
});
test('unverified or unsigned edges cannot establish a cluster',()=>{
 assert.deepEqual(buildEvidenceClusters([{from:'a',to:'b',strength:'strong',verifiedTransfer:false,signature:'tx'}]),[]);
 assert.deepEqual(buildEvidenceClusters([{from:'a',to:'b',strength:'strong',verifiedTransfer:true}]),[]);
});
test('complete consistent snapshot is accepted',()=>{
 assert.equal(validateHolderSnapshot({slot:123,complete:true,circulatingSupply:100,holders:[{wallet:'a',balance:40},{wallet:'b',balance:60}]}).valid,true);
});
test('missing slot, incomplete snapshot and excess balance are rejected',()=>{
 const base={slot:123,complete:true,circulatingSupply:100,holders:[{wallet:'a',balance:40},{wallet:'b',balance:60}]};
 assert.equal(validateHolderSnapshot({...base,slot:undefined}).valid,false);
 assert.equal(validateHolderSnapshot({...base,complete:false}).valid,false);
 assert.equal(validateHolderSnapshot({...base,holders:[{wallet:'a',balance:110}]}).valid,false);
});
