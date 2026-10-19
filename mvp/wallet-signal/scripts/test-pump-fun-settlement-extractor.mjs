import assert from 'node:assert/strict';
import {extractPumpFunSettlementEvidence} from '../lib/pumpFunSettlementEvidenceExtractor.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
const result=extractPumpFunSettlementEvidence({mint,creator,signature:'1'.repeat(88),
 transaction:{meta:{err:null,preTokenBalances:[],postTokenBalances:[]},transaction:{message:{accountKeys:[],instructions:[]}}}});
assert.equal(result,null);
import {createHash} from 'node:crypto';
import {derivePumpFunBondingCurveAccounts} from '../lib/pumpFunBondingCurveDerivation.mjs';
import {PUMP_FUN_PROGRAM_ID} from '../lib/pumpFunSellCandidates.mjs';
const derived=derivePumpFunBondingCurveAccounts({mint});
const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function encode58(buf){let n=BigInt('0x'+buf.toString('hex'));let out='';while(n>0n){out=alphabet[Number(n%58n)]+out;n/=58n;}return out;}
const payload=Buffer.alloc(24);
createHash('sha256').update('global:sell').digest().copy(payload,0,0,8);
payload.writeBigUInt64LE(100n,8);
const keys=['source-ata',derived.poolTokenAccount,mint,derived.bondingCurve,creator,PUMP_FUN_PROGRAM_ID];
const ix={programId:PUMP_FUN_PROGRAM_ID,data:encode58(payload),accounts:['global','fees',mint,derived.bondingCurve,derived.poolTokenAccount,'source-ata',creator,'system','token','rent','event',PUMP_FUN_PROGRAM_ID]};
const tx={blockTime:1700000000,transaction:{message:{accountKeys:keys,instructions:[ix]}},meta:{err:null,
 preTokenBalances:[{accountIndex:0,mint,owner:creator,uiTokenAmount:{amount:'200'}},{accountIndex:1,mint,owner:derived.bondingCurve,uiTokenAmount:{amount:'100'}}],
 postTokenBalances:[{accountIndex:0,mint,owner:creator,uiTokenAmount:{amount:'100'}},{accountIndex:1,mint,owner:derived.bondingCurve,uiTokenAmount:{amount:'200'}}],
 innerInstructions:[{index:0,instructions:[
 {program:'spl-token',parsed:{type:'transferChecked',info:{source:'source-ata',destination:derived.poolTokenAccount,mint,tokenAmount:{amount:'100'}}}},
 {program:'system',parsed:{type:'transfer',info:{source:derived.bondingCurve,destination:creator,lamports:100000}}}
 ]}]}};
const extracted=extractPumpFunSettlementEvidence({mint,creator,signature:'1'.repeat(88),transaction:tx});
assert.equal(extracted.sourceOwnershipVerified,true);
assert.equal(extracted.transactionInstructionLinked,true);
assert.equal(extracted.creatorReceivedLamports,'100000');
assert.equal(extracted.independentlyDecoded,false);
assert.equal(extracted.historicalPoolOwnershipVerified,true);
assert.equal(extracted.poolTokenReceiptVerified,true);
assert.equal(extracted.independentlyDecoded,false);
console.log('Pump.fun settlement evidence extractor tests passed');
