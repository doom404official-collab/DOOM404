import assert from 'node:assert/strict';
import {verifyPumpFunPoolTokenAccountState} from '../lib/pumpFunPoolAccountState.mjs';
import {derivePumpFunBondingCurveAccounts} from '../lib/pumpFunBondingCurveDerivation.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const derived=derivePumpFunBondingCurveAccounts({mint});
const accountInfo={value:{data:{parsed:{type:'account',info:{mint,owner:derived.bondingCurve}}}}};
assert.equal(verifyPumpFunPoolTokenAccountState({mint,poolTokenAccount:derived.poolTokenAccount,accountInfo}).ownershipVerified,true);
assert.equal(verifyPumpFunPoolTokenAccountState({mint,poolTokenAccount:derived.poolTokenAccount,accountInfo:{value:{data:{parsed:{type:'account',info:{mint,owner:'wrong'}}}}}}).status,'UNVERIFIED');
console.log('Pump.fun pool token account state tests passed');
