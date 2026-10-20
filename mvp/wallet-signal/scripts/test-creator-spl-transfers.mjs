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
assert.equal(events[0].independentlyVerified,false);
assert.equal(events[0].classification,'UNVERIFIED_SPL_TRANSFER');
console.log('creator SPL transfer observation tests passed');
