import assert from 'node:assert/strict';
import {corroboratePumpFunSolPayment} from '../lib/pumpFunSolPaymentCorroboration.mjs';
import {derivePumpFunBondingCurveAccounts} from '../lib/pumpFunBondingCurveDerivation.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
const pool=derivePumpFunBondingCurveAccounts({mint}).bondingCurve;
const transaction={transaction:{message:{accountKeys:[{pubkey:creator}],instructions:[]}},meta:{
 err:null,preBalances:[1000000],postBalances:[1100000],innerInstructions:[{instructions:[
 {program:'system',parsed:{type:'transfer',info:{source:pool,destination:creator,lamports:100000}}}
 ]}]}};
const result=corroboratePumpFunSolPayment({mint,creator,transaction});
assert.equal(result.status,'POOL_SOL_PAYMENT_OBSERVED');
assert.equal(result.transferLamports,'100000');
assert.equal(result.settlementVerified,false);
console.log('Pump.fun SOL payment corroboration tests passed');
