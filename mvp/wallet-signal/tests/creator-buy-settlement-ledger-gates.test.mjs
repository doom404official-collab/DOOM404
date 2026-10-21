import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectCreatorHistoricalBatch} from '../lib/creatorHistoricalTransactionBatch.mjs';
import {reconcilePumpFunCreatorBuy} from '../lib/pumpFunCreatorBuyReconciliation.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
// Synthetic legacy settlement fixture: deliberately reaches the existing promotion gate.
// This does not assert Token-2022 settlement or authorize live promotion.
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

async function run(independentSettlement){
 assert.equal(reconcilePumpFunCreatorBuy({mint,creator,transaction:tx}).status,'BALANCES_CORROBORATED');
 let calls=0;
 const result=await inspectCreatorHistoricalBatch({mint,creator,signatures:[signature],maxTransactions:1,
  rpc:{fetchTransaction:async()=>structuredClone(tx)},
  buySettlementDecoder:async()=>{calls++;return independentSettlement;}});
 assert.equal(calls,1);
 assert.deepEqual(result.processed,[signature]);
 assert.deepEqual(result.pending,[]);
 return result;
}
test('positive corroborated settlement control reaches the acquisition ledger',async()=>{
 const result=await run(proof);
 assert.equal(result.verifiedAcquisitionEvents.length,1);
 assert.equal(result.verifiedAcquisitionEvents[0].type,'PURCHASE');
 assert.equal(result.verifiedAcquisitionEvents[0].amountRaw,'100');
});
for(const field of ['protocolVerified','settlementVerified','independentlyVerified']){
 test(`corroborated purchase without strict ${field} cannot enter acquisition ledger`,async()=>{
  for(const value of [false,undefined,'true',1]){
   const result=await run({...proof,[field]:value});
   assert.deepEqual(result.verifiedAcquisitionEvents,[]);
  }
 });
}
