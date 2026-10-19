import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {locatePumpFunSellInstructions} from '../lib/pumpFunSellInstructionLink.mjs';
import {PUMP_FUN_PROGRAM_ID} from '../lib/pumpFunSellCandidates.mjs';
const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function encode58(buf){let n=BigInt('0x'+buf.toString('hex'));let out='';while(n>0n){out=alphabet[Number(n%58n)]+out;n/=58n;}return out;}
const bytes=Buffer.alloc(24);
createHash('sha256').update('global:sell').digest().copy(bytes,0,0,8);
bytes.writeBigUInt64LE(100n,8);
const transaction={transaction:{message:{accountKeys:[PUMP_FUN_PROGRAM_ID],instructions:[
 {programIdIndex:0,data:'invalid'},{programIdIndex:0,data:encode58(bytes)}]}},meta:{err:null}};
const result=locatePumpFunSellInstructions({transaction});
assert.equal(result.length,1);
assert.equal(result[0].outerInstructionIndex,1);
assert.equal(result[0].settlementVerified,false);
console.log('Pump.fun sell instruction linkage tests passed');
