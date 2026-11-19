import assert from 'node:assert/strict';
import {observeCreatorSplTransfers} from '../lib/creatorSplTransferObservations.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
const transaction={transaction:{message:{instructions:[]}},meta:{err:null,innerInstructions:[
 {index:0,instructions:[{program:'spl-token',parsed:{type:'transferChecked',info:{
 source:'source',destination:'destination',mint,tokenAmount:{amount:'100'}}}}]}]}};
const events=observeCreatorSplTransfers({mint,creator,signature:'sig',transaction});
assert.equal(events.length,1);
assert.equal(events[0].amountRaw,'100');
assert.equal(events[0].instructionIndex,0);
assert.equal(events[0].innerInstructionIndex,0);
assert.equal(events[0].independentlyVerified,false);
assert.equal(events[0].classification,'UNVERIFIED_SPL_TRANSFER');
const tx2={transaction:{message:{instructions:[]}},meta:{err:null,innerInstructions:[
 {index:0,instructions:[
 {program:'spl-token',parsed:{type:'transferChecked',info:{source:'a',destination:'b',mint,tokenAmount:{amount:'10'}}}},
 {program:'spl-token',parsed:{type:'transferChecked',info:{source:'c',destination:'d',mint,tokenAmount:{amount:'20'}}}}
 ]}]}};
const separate=observeCreatorSplTransfers({mint,creator,signature:'sig',transaction:tx2});
assert.equal(separate.length,2);
assert.equal(separate[0].instructionIndex,separate[1].instructionIndex);
assert.notEqual(separate[0].innerInstructionIndex,separate[1].innerInstructionIndex);
console.log('creator SPL transfer observation tests passed');
