import test from 'node:test';
import assert from 'node:assert/strict';
import {freezeTop20Snapshot} from './frozenTop20Investigation.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const burn='1nc1nerator11111111111111111111111111111111';
const snapshot={slot:123,circulatingSupply:10000,holders:[{wallet:burn,balance:500},
 ...Array.from({length:21},(_,i)=>({wallet:'holder'+i,balance:100-i}))]};
test('excluded incinerator is replaced with next eligible holder',()=>{
 const result=freezeTop20Snapshot({mint,snapshot,excludedWallets:[burn]});
 assert.equal(result.holders.length,20);
 assert.equal(result.holders.some(h=>h.wallet===burn),false);
 assert.equal(result.holders.at(-1).wallet,'holder19');
});
test('snapshot identity records exclusion policy',()=>{
 const normal=freezeTop20Snapshot({mint,snapshot});
 const excluded=freezeTop20Snapshot({mint,snapshot,excludedWallets:[burn]});
 assert.notEqual(normal.id,excluded.id);
});
