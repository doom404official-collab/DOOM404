import assert from 'node:assert/strict';
import {assessPumpFunCreatorSellTransaction} from '../lib/pumpFunCreatorSellAssessment.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
const result=assessPumpFunCreatorSellTransaction({mint,creator,signature:'1'.repeat(88),transaction:{meta:{err:null},
 transaction:{message:{accountKeys:[],instructions:[]}}}});
assert.equal(result.status,'UNVERIFIED');
assert.equal(result.saleVerified,undefined);
console.log('Pump.fun creator sell assessment tests passed');
