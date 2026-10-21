import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectToken2022PumpFunBuySettlement} from '../lib/pumpFunToken2022BuySettlementShadow.mjs';
const mint='79iierYMVj263HYVtXWz3eCJosUpAvhkERCT6kGipump';
const buyer='9KRxX586FycrWYvAn61hZhcGDqfEGKQKhmQUBM2qLmda';
test('missing transaction fails closed',()=>{
 const r=inspectToken2022PumpFunBuySettlement({mint,buyer,transaction:null});
 assert.equal(r.status,'UNVERIFIED');
 assert.equal(r.reason,'INVALID_TRANSACTION');
 assert.equal(r.eligibleForLivePromotion,false);
});
test('transaction without recognized buy group fails closed',()=>{
 const transaction={meta:{err:null,innerInstructions:[]},transaction:{message:{instructions:[],accountKeys:[]}}};
 const r=inspectToken2022PumpFunBuySettlement({mint,buyer,transaction});
 assert.equal(r.reason,'BUY_GROUP_NOT_UNIQUE');
 assert.equal(r.eligibleForLivePromotion,false);
});

test('failed on-chain transaction cannot produce a settlement observation',()=>{
 const transaction={meta:{err:{InstructionError:[0,'Custom']}},transaction:{message:{instructions:[],accountKeys:[]}}};
 const r=inspectToken2022PumpFunBuySettlement({mint,buyer,transaction});
 assert.equal(r.status,'UNVERIFIED');
 assert.equal(r.reason,'INVALID_TRANSACTION');
 assert.equal(r.eligibleForLivePromotion,false);
});

test('Token-2022 program identity is not inferred from a display label',()=>{
 const transaction={meta:{err:null,innerInstructions:[]},transaction:{message:{instructions:[],accountKeys:[]}}};
 const result=inspectToken2022PumpFunBuySettlement({mint,buyer,transaction});
 assert.equal(result.status,'UNVERIFIED');
 assert.equal(result.eligibleForLivePromotion,false);
});

test('missing buyer and pool balance evidence cannot be treated as verified settlement',()=>{
 const transaction={meta:{err:null,innerInstructions:[],preTokenBalances:[],postTokenBalances:[]},transaction:{message:{instructions:[],accountKeys:[]}}};
 const result=inspectToken2022PumpFunBuySettlement({mint,buyer,transaction});
 assert.equal(result.status,'UNVERIFIED');
 assert.equal(result.eligibleForLivePromotion,false);
});

test('shadow reviewer never emits promotable settlement flags',()=>{
 const r=inspectToken2022PumpFunBuySettlement({mint,buyer,transaction:null});
 assert.notEqual(r.eligibleForLivePromotion,true);
 assert.notEqual(r.settlementVerified,true);
 assert.notEqual(r.independentlyVerified,true);
});
