import assert from 'node:assert/strict';
import {promotePumpFunCreatorBuy} from '../lib/pumpFunCreatorBuyPromotion.mjs';
import {extractIndependentPumpFunBuySettlement} from '../lib/pumpFunIndependentBuySettlement.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
const transaction={transaction:{message:{accountKeys:[],instructions:[]}},meta:{err:null,preTokenBalances:[],postTokenBalances:[]}};
assert.equal(promotePumpFunCreatorBuy({mint,creator,signature:'sig',transaction,
 independentSettlement:{protocolVerified:true,settlementVerified:true,independentlyVerified:true}}).status,'UNVERIFIED');
import {createHash} from 'node:crypto';
import {derivePumpFunBondingCurveAccounts} from '../lib/pumpFunBondingCurveDerivation.mjs';
import {PUMP_FUN_PROGRAM_ID} from '../lib/pumpFunSellCandidates.mjs';
const derived=derivePumpFunBondingCurveAccounts({mint});
const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function encode58(bytes){let n=BigInt('0x'+bytes.toString('hex'));let out='';while(n>0n){out=alphabet[Number(n%58n)]+out;n/=58n;}return out;}
const payload=Buffer.alloc(24);createHash('sha256').update('global:buy').digest().copy(payload,0,0,8);
payload.writeBigUInt64LE(100n,8);payload.writeBigUInt64LE(200000n,16);
const buy={programId:PUMP_FUN_PROGRAM_ID,data:encode58(payload)};
const tx={blockTime:1700000000,transaction:{message:{accountKeys:[creator,'buyer-ata',derived.poolTokenAccount],instructions:[buy]}},meta:{
 err:null,fee:5000,preBalances:[1000000,0,0],postBalances:[895000,0,0],
 preTokenBalances:[{accountIndex:1,mint,owner:creator,uiTokenAmount:{amount:'0'}},
 {accountIndex:2,mint,owner:derived.bondingCurve,uiTokenAmount:{amount:'1000'}}],
 postTokenBalances:[{accountIndex:1,mint,owner:creator,uiTokenAmount:{amount:'100'}},
 {accountIndex:2,mint,owner:derived.bondingCurve,uiTokenAmount:{amount:'900'}}],
 innerInstructions:[{index:0,instructions:[
 {program:'spl-token',parsed:{type:'transferChecked',info:{source:derived.poolTokenAccount,destination:'buyer-ata',mint,tokenAmount:{amount:'100'}}}},
 {program:'system',parsed:{type:'transfer',info:{source:creator,destination:derived.bondingCurve,lamports:100000}}}
 ]}]}};
const signature='2'.repeat(88);
const proof={signature,instructionIndex:0,mint,creator,amountRaw:'100',solPaidLamports:'100000',
 timestamp:1700000000,protocolVerified:true,settlementVerified:true,independentlyVerified:true};
const promoted=promotePumpFunCreatorBuy({mint,creator,signature,transaction:tx,independentSettlement:proof});
assert.equal(promoted.status,'VERIFIED');
assert.equal(promoted.event.type,'PURCHASE');
assert.equal(promoted.event.amountRaw,'100');
assert.equal(promotePumpFunCreatorBuy({mint,creator,signature,transaction:tx,
 independentSettlement:{...proof,solPaidLamports:'99999'}}).status,'UNVERIFIED');
const extracted=extractIndependentPumpFunBuySettlement({mint,creator,signature,transaction:tx});
assert.equal(extracted?.independentlyVerified,true);
assert.equal(promotePumpFunCreatorBuy({mint,creator,signature,transaction:tx,independentSettlement:extracted}).status,'VERIFIED');
console.log('Pump.fun creator buy promotion gate tests passed');
