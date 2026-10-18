import assert from 'node:assert/strict';
import {observePumpFunPoolTokenSettlement} from '../lib/pumpFunPoolTokenObservation.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const transaction={transaction:{message:{accountKeys:['pool']}},meta:{err:null,preTokenBalances:[{mint,accountIndex:0,uiTokenAmount:{amount:'100'}}],
 postTokenBalances:[{mint,accountIndex:0,uiTokenAmount:{amount:'300'}}]}};
const unknown=observePumpFunPoolTokenSettlement({transaction,mint});
assert.equal(unknown.status,'UNVERIFIED');
const observed=observePumpFunPoolTokenSettlement({transaction,mint,poolTokenAccounts:['pool']});
assert.equal(observed.status,'POOL_TOKEN_RECEIPT_OBSERVED');
assert.equal(observed.poolReceivedRaw,'200');
assert.equal(observed.settlementIndependentlyVerified,false);
console.log('Pump.fun pool token observation tests passed');
