import assert from 'node:assert/strict';
import {corroboratePumpFunCreatorBuySettlement} from '../lib/pumpFunCreatorBuySettlement.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
const tx={transaction:{message:{accountKeys:[],instructions:[]}},meta:{err:null,preTokenBalances:[],postTokenBalances:[]}};
assert.deepEqual(corroboratePumpFunCreatorBuySettlement({mint,creator,transaction:tx}),[]);
console.log('Pump.fun creator buy settlement corroboration tests passed');
