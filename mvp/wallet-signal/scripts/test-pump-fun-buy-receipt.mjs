import assert from 'node:assert/strict';
import {observePumpFunCreatorBuyReceipt} from '../lib/pumpFunCreatorBuyReceipt.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
assert.deepEqual(observePumpFunCreatorBuyReceipt({mint,creator,transaction:{
 transaction:{message:{accountKeys:[],instructions:[]}},meta:{err:null,preTokenBalances:[],postTokenBalances:[]}}}),[]);
console.log('Pump.fun creator buy receipt tests passed');
