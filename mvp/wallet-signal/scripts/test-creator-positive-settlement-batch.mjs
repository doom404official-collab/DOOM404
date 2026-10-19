import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectCreatorHistoricalBatch} from '../lib/creatorHistoricalTransactionBatch.mjs';
import {derivePumpFunBondingCurveAccounts} from '../lib/pumpFunBondingCurveDerivation.mjs';
import {PUMP_FUN_PROGRAM_ID} from '../lib/pumpFunSellCandidates.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
const signature='1'.repeat(88);
const derived=derivePumpFunBondingCurveAccounts({mint});
const keys=[{pubkey:creator,signer:true},'source-ata',derived.poolTokenAccount,mint,derived.bondingCurve,PUMP_FUN_PROGRAM_ID];
const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function encode58(buf){let n=BigInt('0x'+buf.toString('hex'));let out='';while(n>0n){out=alphabet[Number(n%58n)]+out;n/=58n;}return out;}
const payload=Buffer.alloc(24);createHash('sha256').update('global:sell').digest().copy(payload,0,0,8);payload.writeBigUInt64LE(100n,8);
const ix={programId:PUMP_FUN_PROGRAM_ID,data:encode58(payload),accounts:[
 'global','fees',mint,derived.bondingCurve,derived.poolTokenAccount,'source-ata',creator,'system','token','rent','event',PUMP_FUN_PROGRAM_ID]};
const tx={blockTime:1700000000,transaction:{message:{accountKeys:keys,instructions:[ix]}},meta:{err:null,
 preBalances:[1000000,0,0,0,0,0],postBalances:[1100000,0,0,0,0,0],
 preTokenBalances:[{accountIndex:1,mint,owner:creator,uiTokenAmount:{amount:'200'}},{accountIndex:2,mint,uiTokenAmount:{amount:'100'}}],
 postTokenBalances:[{accountIndex:1,mint,owner:creator,uiTokenAmount:{amount:'100'}},{accountIndex:2,mint,uiTokenAmount:{amount:'200'}}],
 innerInstructions:[{index:0,instructions:[
 {program:'spl-token',parsed:{type:'transferChecked',info:{source:'source-ata',destination:derived.poolTokenAccount,mint,tokenAmount:{amount:'100'}}}},
 {program:'system',parsed:{type:'transfer',info:{source:derived.bondingCurve,destination:creator,lamports:100000}}}
 ]}]}};
let invoked=0;
const settlementDecoder=async()=>{invoked++;return {independentlyDecoded:true,signature,creator,mint,
 programId:PUMP_FUN_PROGRAM_ID,instructionType:'SELL',poolTokenReceiptVerified:true,
 creatorSolReceiptVerified:true,outputAsset:'SOL',soldRaw:'100',creatorReceivedLamports:'100000',
 timestamp:1700000000,decoderVersion:'fixture-v1'};};
const result=await inspectCreatorHistoricalBatch({mint,creator,signatures:[signature],
 rpc:{fetchTransaction:async()=>tx},settlementDecoder});
assert.equal(invoked,1);
assert.equal(result.verifiedSales.length,1);
assert.equal(result.verifiedSales[0].soldRaw,'100');
console.log('creator positive historical settlement batch tests passed');
