import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {decodePumpFunBuyInstruction} from '../lib/pumpFunBuyInstruction.mjs';
import {PUMP_FUN_PROGRAM_ID} from '../lib/pumpFunSellCandidates.mjs';
const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function encode58(buf){let n=BigInt('0x'+buf.toString('hex'));let out='';while(n>0n){out=alphabet[Number(n%58n)]+out;n/=58n;}return out;}
const bytes=Buffer.alloc(24);
createHash('sha256').update('global:buy').digest().copy(bytes,0,0,8);
bytes.writeBigUInt64LE(100n,8);bytes.writeBigUInt64LE(500n,16);
const candidate=decodePumpFunBuyInstruction({instruction:{data:encode58(bytes)},programId:PUMP_FUN_PROGRAM_ID});
assert.equal(candidate.requestedTokenRaw,'100');
assert.equal(candidate.maxSolCostLamports,'500');
assert.equal(candidate.purchaseVerified,false);
assert.equal(decodePumpFunBuyInstruction({instruction:{data:encode58(bytes)},programId:'wrong'}),null);
console.log('Pump.fun buy payload candidate tests passed');
