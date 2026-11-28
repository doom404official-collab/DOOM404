import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifyPumpFunCreatorSellCandidate} from '../lib/pumpFunCreatorSellCorroboration.mjs';
import {PUMP_FUN_PROGRAM_ID} from '../lib/pumpFunSellCandidates.mjs';
const creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function encode58(buf){let n=BigInt('0x'+buf.toString('hex'));let out='';while(n>0n){out=alphabet[Number(n%58n)]+out;n/=58n;}return out;}
const bytes=Buffer.alloc(24);
createHash('sha256').update('global:sell').digest().copy(bytes,0,0,8);
bytes.writeBigUInt64LE(200n,8);bytes.writeBigUInt64LE(10n,16);
const transaction={transaction:{message:{accountKeys:[{pubkey:creator,signer:true}],instructions:[{programId:PUMP_FUN_PROGRAM_ID,data:encode58(bytes)}]}},
 meta:{err:null,innerInstructions:[],preTokenBalances:[{mint,owner:creator,uiTokenAmount:{amount:'1000'}}],
 postTokenBalances:[{mint,owner:creator,uiTokenAmount:{amount:'800'}}],preBalances:[1000000],postBalances:[1100000]}};
const result=verifyPumpFunCreatorSellCandidate({mint,creator,signature:'1'.repeat(88),transaction});
assert.equal(result.status,'CORROBORATED_CANDIDATE');
assert.equal(result.soldRaw,'200');
assert.equal(result.saleVerified,false);
const noReceipt=verifyPumpFunCreatorSellCandidate({mint,creator,signature:'1'.repeat(88),
 transaction:{...transaction,meta:{...transaction.meta,postBalances:[900000]}}});
assert.equal(noReceipt.status,'UNVERIFIED');
console.log('Pump.fun creator sell corroboration tests passed');
