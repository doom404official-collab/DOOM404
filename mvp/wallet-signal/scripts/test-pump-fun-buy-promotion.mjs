import assert from 'node:assert/strict';
import {promotePumpFunCreatorBuy} from '../lib/pumpFunCreatorBuyPromotion.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
const transaction={transaction:{message:{accountKeys:[],instructions:[]}},meta:{err:null,preTokenBalances:[],postTokenBalances:[]}};
assert.equal(promotePumpFunCreatorBuy({mint,creator,signature:'sig',transaction,
 independentSettlement:{protocolVerified:true,settlementVerified:true,independentlyVerified:true}}).status,'UNVERIFIED');
console.log('Pump.fun creator buy promotion gate tests passed');
