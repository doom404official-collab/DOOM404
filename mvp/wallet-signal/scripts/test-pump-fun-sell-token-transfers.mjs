import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {observePumpFunSellTokenTransfers} from '../lib/pumpFunSellTokenTransfers.mjs';
import {PUMP_FUN_PROGRAM_ID} from '../lib/pumpFunSellCandidates.mjs';
const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function encode58(buf){let n=BigInt('0x'+buf.toString('hex'));let out='';while(n>0n){out=alphabet[Number(n%58n)]+out;n/=58n;}return out;}
const bytes=Buffer.alloc(24);
createHash('sha256').update('global:sell').digest().copy(bytes,0,0,8);bytes.writeBigUInt64LE(100n,8);
const transaction={transaction:{message:{accountKeys:[PUMP_FUN_PROGRAM_ID],instructions:[
 {programIdIndex:0,data:'invalid'},{programIdIndex:0,data:encode58(bytes)}]}},
 meta:{err:null,innerInstructions:[{index:0,instructions:[{program:'spl-token',parsed:{type:'transfer',info:{source:'wrong',destination:'wrong',amount:'999'}}}]},
 {index:1,instructions:[{program:'spl-token',parsed:{type:'transferChecked',info:{source:'creator-ata',destination:'pool-ata',tokenAmount:{amount:'100'}}}}]}]}};
const result=observePumpFunSellTokenTransfers({transaction});
assert.equal(result.length,1);
assert.equal(result[0].transfers.length,1);
assert.equal(result[0].transfers[0].amountRaw,'100');
assert.equal(result[0].transfers[0].verified,false);
console.log('Pump.fun sell token transfer group tests passed');
