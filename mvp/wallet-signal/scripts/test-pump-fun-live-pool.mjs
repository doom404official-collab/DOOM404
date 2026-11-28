import assert from 'node:assert/strict';
import {verifyLivePumpFunPoolAccount} from '../lib/pumpFunLivePoolVerification.mjs';
import {derivePumpFunBondingCurveAccounts} from '../lib/pumpFunBondingCurveDerivation.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const derived=derivePumpFunBondingCurveAccounts({mint});
let calls=0;
const result=await verifyLivePumpFunPoolAccount({mint,poolTokenAccount:derived.poolTokenAccount,rpc:{
 getParsedAccountInfo:async()=>{calls++;return {value:{data:{parsed:{type:'account',info:{mint,owner:derived.bondingCurve}}}}};}
}});
assert.equal(calls,1);
assert.equal(result.ownershipVerified,true);
assert.equal(result.historicalOwnershipVerified,false);
console.log('Pump.fun live pool verification tests passed');
