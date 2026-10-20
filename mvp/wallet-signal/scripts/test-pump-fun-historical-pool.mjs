import assert from 'node:assert/strict';
import {verifyHistoricalPumpFunPoolOwnership} from '../lib/pumpFunHistoricalPoolOwnership.mjs';
import {derivePumpFunBondingCurveAccounts} from '../lib/pumpFunBondingCurveDerivation.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const derived=derivePumpFunBondingCurveAccounts({mint});
const tx={transaction:{message:{accountKeys:[derived.poolTokenAccount]}},meta:{err:null,
 preTokenBalances:[{accountIndex:0,mint,owner:derived.bondingCurve,uiTokenAmount:{amount:'100'}}],
 postTokenBalances:[{accountIndex:0,mint,owner:derived.bondingCurve,uiTokenAmount:{amount:'200'}}]}};
assert.equal(verifyHistoricalPumpFunPoolOwnership({mint,transaction:tx}).historicalOwnershipVerified,true);
const missing={...tx,meta:{...tx.meta,postTokenBalances:[{accountIndex:0,mint,uiTokenAmount:{amount:'200'}}]}};
assert.equal(verifyHistoricalPumpFunPoolOwnership({mint,transaction:missing}).status,'UNVERIFIED');
console.log('Pump.fun historical pool ownership tests passed');
