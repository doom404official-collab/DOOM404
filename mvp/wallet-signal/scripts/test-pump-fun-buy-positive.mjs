import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {reconcilePumpFunCreatorBuy} from '../lib/pumpFunCreatorBuyReconciliation.mjs';
import {derivePumpFunBondingCurveAccounts} from '../lib/pumpFunBondingCurveDerivation.mjs';
import {PUMP_FUN_PROGRAM_ID} from '../lib/pumpFunSellCandidates.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
const derived=derivePumpFunBondingCurveAccounts({mint});
const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function encode58(bytes){let n=BigInt('0x'+bytes.toString('hex'));let out='';while(n>0n){out=alphabet[Number(n%58n)]+out;n/=58n;}return out;}
const payload=Buffer.alloc(24);createHash('sha256').update('global:buy').digest().copy(payload,0,0,8);
payload.writeBigUInt64LE(100n,8);payload.writeBigUInt64LE(200000n,16);
const buy={programId:PUMP_FUN_PROGRAM_ID,data:encode58(payload)};
const tx={transaction:{message:{accountKeys:[creator,'buyer-ata',derived.poolTokenAccount],instructions:[buy]}},meta:{
 err:null,fee:5000,preBalances:[1000000,0,0],postBalances:[895000,0,0],
 preTokenBalances:[{accountIndex:0,mint,owner:creator,uiTokenAmount:{amount:'0'}},
 {accountIndex:2,mint,owner:derived.bondingCurve,uiTokenAmount:{amount:'1000'}}],
 postTokenBalances:[{accountIndex:0,mint,owner:creator,uiTokenAmount:{amount:'100'}},
 {accountIndex:2,mint,owner:derived.bondingCurve,uiTokenAmount:{amount:'900'}}],
 innerInstructions:[{index:0,instructions:[
 {program:'spl-token',parsed:{type:'transferChecked',info:{source:derived.poolTokenAccount,destination:creator,mint,tokenAmount:{amount:'100'}}}},
 {program:'system',parsed:{type:'transfer',info:{source:creator,destination:derived.bondingCurve,lamports:100000}}}
 ]}]}};
const good=reconcilePumpFunCreatorBuy({mint,creator,transaction:tx});
assert.equal(good.status,'BALANCES_CORROBORATED');
assert.equal(good.purchaseVerified,false);
assert.equal(reconcilePumpFunCreatorBuy({mint,creator,transaction:{...tx,meta:{...tx.meta,fee:0}}}).status,'UNVERIFIED');
assert.equal(reconcilePumpFunCreatorBuy({mint,creator,transaction:{...tx,transaction:{message:{...tx.transaction.message,instructions:[buy,buy]}}}}).status,'UNVERIFIED');
console.log('Pump.fun buy positive fee reconciliation tests passed');
