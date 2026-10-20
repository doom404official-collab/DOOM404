import assert from 'node:assert/strict';
import {corroboratePumpFunSellTokenPath} from '../lib/pumpFunSellTokenPath.mjs';
import {derivePumpFunBondingCurveAccounts} from '../lib/pumpFunBondingCurveDerivation.mjs';
import {PUMP_FUN_PROGRAM_ID} from '../lib/pumpFunSellCandidates.mjs';
import {createHash} from 'node:crypto';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const pool=derivePumpFunBondingCurveAccounts({mint}).poolTokenAccount;
const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function encode58(buf){let n=BigInt('0x'+buf.toString('hex'));let out='';while(n>0n){out=alphabet[Number(n%58n)]+out;n/=58n;}return out;}
const bytes=Buffer.alloc(24);createHash('sha256').update('global:sell').digest().copy(bytes,0,0,8);bytes.writeBigUInt64LE(100n,8);
const tx={transaction:{message:{accountKeys:[PUMP_FUN_PROGRAM_ID],instructions:[{programIdIndex:0,data:encode58(bytes)}]}},
 meta:{err:null,innerInstructions:[{index:0,instructions:[{program:'spl-token',parsed:{type:'transferChecked',info:{source:'creator-ata',destination:pool,tokenAmount:{amount:'100'},mint}}}]}]}};
const result=corroboratePumpFunSellTokenPath({mint,transaction:tx,creatorTokenAccounts:['creator-ata']});
assert.equal(result.status,'TOKEN_PATH_CORROBORATED');
assert.equal(result.sourceOwnershipVerified,false);
assert.equal(corroboratePumpFunSellTokenPath({mint,transaction:tx,creatorTokenAccounts:['other']}).status,'UNVERIFIED');
console.log('Pump.fun sell token path tests passed');
