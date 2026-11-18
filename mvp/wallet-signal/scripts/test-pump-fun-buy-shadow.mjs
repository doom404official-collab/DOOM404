import assert from 'node:assert/strict';
import {inspectPumpFunBuyShadow} from '../lib/pumpFunBuyShadowValidation.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
const transaction={transaction:{message:{accountKeys:[],instructions:[]}},
 meta:{err:null,preTokenBalances:[],postTokenBalances:[]}};
const result=inspectPumpFunBuyShadow({mint,creator,signature:'1'.repeat(88),transaction});
assert.equal(result.purchaseVerified,false);
assert.equal(result.status,'NO_VERIFIED_BUY_EVIDENCE');
console.log('Pump.fun shadow buy validation tests passed');
