import assert from 'node:assert/strict';
import {reconcilePumpFunCreatorBuy} from '../lib/pumpFunCreatorBuyReconciliation.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
const tx={transaction:{message:{accountKeys:[creator],instructions:[]}},meta:{err:null,
 preBalances:[1000000],postBalances:[900000],preTokenBalances:[],postTokenBalances:[]}};
const result=reconcilePumpFunCreatorBuy({mint,creator,transaction:tx});
assert.equal(result.status,'UNVERIFIED');
assert.equal(result.reason,'AMBIGUOUS_OR_MISSING_BUY');
console.log('Pump.fun creator buy balance reconciliation tests passed');
