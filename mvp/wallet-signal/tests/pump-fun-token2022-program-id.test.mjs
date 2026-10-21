import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {PublicKey} from '@solana/web3.js';
import {inspectToken2022PumpFunBuySettlement} from '../lib/pumpFunToken2022BuySettlementShadow.mjs';
import {derivePumpFunBondingCurveAccounts} from '../lib/pumpFunBondingCurveDerivation.mjs';
import {PUMP_FUN_PROGRAM_ID} from '../lib/pumpFunSellCandidates.mjs';

const TOKEN_2022='TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const LEGACY_TOKEN='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const ATA=new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
// Deterministic synthetic keys and balances. No RPC or historical transaction claims.
const key=byte=>new PublicKey(Uint8Array.from({length:32},()=>byte)).toBase58();
const mint=key(11),buyer=key(12),destination=key(13);
function encode58(bytes){
 const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
 let n=BigInt('0x'+bytes.toString('hex')),out='';
 while(n){out=alphabet[Number(n%58n)]+out;n/=58n;}
 for(const byte of bytes){if(byte!==0)break;out='1'+out;}
 return out;
}
function fixture({program='spl-token',programId=TOKEN_2022}={}){
 const {bondingCurve}=derivePumpFunBondingCurveAccounts({mint});
 const pool=PublicKey.findProgramAddressSync([
  new PublicKey(bondingCurve).toBuffer(),new PublicKey(TOKEN_2022).toBuffer(),new PublicKey(mint).toBuffer()
 ],ATA)[0].toBase58();
 const data=Buffer.alloc(24);
 createHash('sha256').update('global:buy').digest().copy(data,0,0,8);
 data.writeBigUInt64LE(10n,8);data.writeBigUInt64LE(100n,16);
 const accounts=[key(14),key(15),mint,bondingCurve,pool,destination,buyer,'11111111111111111111111111111111',TOKEN_2022];
 const balance=(accountIndex,owner,amount)=>({accountIndex,owner,mint,uiTokenAmount:{amount,decimals:6}});
 return {transaction:{message:{accountKeys:accounts,instructions:[{programId:PUMP_FUN_PROGRAM_ID,accounts,data:encode58(data)}]}},meta:{
  err:null,fee:5,preBalances:accounts.map((_,i)=>i===6?1000:0),postBalances:accounts.map((_,i)=>i===6?895:0),
  preTokenBalances:[balance(4,bondingCurve,'100'),balance(5,buyer,'0')],
  postTokenBalances:[balance(4,bondingCurve,'90'),balance(5,buyer,'10')],
  innerInstructions:[{index:0,instructions:[
   {program,programId,parsed:{type:'transferChecked',info:{source:pool,destination,mint,tokenAmount:{amount:'10',decimals:6}}}},
   {program:'system',programId:'11111111111111111111111111111111',parsed:{type:'transfer',info:{source:buyer,destination:bondingCurve,lamports:100}}}
  ]}]
 }};
}
test('exact Token-2022 ID accepts spl-token RPC label and reaches reconciled observation without promotion',()=>{
 const result=inspectToken2022PumpFunBuySettlement({mint,buyer,transaction:fixture()});
 assert.equal(result.status,'EVIDENCE_OBSERVED_UNVERIFIED');
 assert.equal(result.instructionIndex,0);
 assert.equal(result.observedBuyerPaymentLamports,'100');
 assert.equal(result.transactionFeeLamports,'5');
 assert.equal(result.paymentCount,1);
 assert.equal(result.eligibleForLivePromotion,false);
 assert.equal(result.settlementVerified,false);
 assert.equal(result.independentlyVerified,false);
});
test('correct-looking display label cannot substitute for Token-2022 program ID',()=>{
 const result=inspectToken2022PumpFunBuySettlement({mint,buyer,transaction:fixture({program:'spl-token-2022',programId:LEGACY_TOKEN})});
 assert.deepEqual(result,{status:'UNVERIFIED',reason:'TOKEN_TRANSFER_NOT_UNIQUE',eligibleForLivePromotion:false});
});
