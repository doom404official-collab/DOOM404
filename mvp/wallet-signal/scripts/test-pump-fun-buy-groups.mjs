import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {groupPumpFunBuyInstructions} from '../lib/pumpFunBuyInstructionGroups.mjs';
import {PUMP_FUN_PROGRAM_ID} from '../lib/pumpFunSellCandidates.mjs';
const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function encode58(buf){let n=BigInt('0x'+buf.toString('hex'));let out='';while(n>0n){out=alphabet[Number(n%58n)]+out;n/=58n;}return out;}
const payload=Buffer.alloc(24);createHash('sha256').update('global:buy').digest().copy(payload,0,0,8);
payload.writeBigUInt64LE(100n,8);payload.writeBigUInt64LE(500n,16);
const transaction={transaction:{message:{accountKeys:[PUMP_FUN_PROGRAM_ID],instructions:[
 {programIdIndex:0,data:'bad'},{programIdIndex:0,data:encode58(payload)}]}},
 meta:{err:null,innerInstructions:[{index:0,instructions:[{program:'system'}]},
 {index:1,instructions:[{program:'spl-token'}]}]}};
const groups=groupPumpFunBuyInstructions({transaction});
assert.equal(groups.length,1);
assert.equal(groups[0].instructionIndex,1);
assert.equal(groups[0].innerInstructions[0].program,'spl-token');
assert.equal(groups[0].purchaseVerified,false);
console.log('Pump.fun buy instruction group tests passed');
