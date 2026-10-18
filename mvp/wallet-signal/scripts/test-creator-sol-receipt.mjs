import assert from 'node:assert/strict';
import {observeCreatorSolReceipt} from '../lib/creatorSolReceiptObservation.mjs';
const creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
const transaction={transaction:{message:{accountKeys:[{pubkey:creator}]}},meta:{
 err:null,preBalances:[1000000],postBalances:[1200000]}};
const result=observeCreatorSolReceipt({transaction,creator});
assert.equal(result.status,'NET_SOL_INCREASE_OBSERVED');
assert.equal(result.netLamports,200000);
assert.equal(result.sourcePoolVerified,false);
assert.equal(result.settlementVerified,false);
assert.equal(observeCreatorSolReceipt({transaction:{...transaction,meta:{...transaction.meta,postBalances:[900000]}},creator}).status,'NO_NET_SOL_INCREASE');
console.log('creator SOL receipt observation tests passed');
