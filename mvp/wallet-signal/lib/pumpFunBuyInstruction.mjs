import {createHash} from 'node:crypto';
import {PUMP_FUN_PROGRAM_ID} from './pumpFunSellCandidates.mjs';
const ALPHABET='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BUY_DISCRIMINATOR=createHash('sha256').update('global:buy').digest().subarray(0,8);
function decode58(value){
 if(typeof value!=='string'||!value)return null;
 let n=0n;for(const c of value){const i=ALPHABET.indexOf(c);if(i<0)return null;n=n*58n+BigInt(i);}
 let hex=n.toString(16);if(hex.length%2)hex='0'+hex;
 return Buffer.concat([Buffer.alloc((value.match(/^1*/)||[''])[0].length),n===0n?Buffer.alloc(0):Buffer.from(hex,'hex')]);
}
/** Legacy Pump.fun buy instruction payload candidate; not proof of purchase settlement. */
export function decodePumpFunBuyInstruction({instruction,programId}={}){
 if(programId!==PUMP_FUN_PROGRAM_ID)return null;
 const bytes=decode58(instruction?.data);
 if(!bytes||bytes.length!==24||!bytes.subarray(0,8).equals(BUY_DISCRIMINATOR))return null;
 const amount=bytes.readBigUInt64LE(8),maxSolCost=bytes.readBigUInt64LE(16);
 if(amount===0n)return null;
 return {kind:'PUMP_FUN_BUY_CANDIDATE',requestedTokenRaw:amount.toString(),
  maxSolCostLamports:maxSolCost.toString(),instructionVerified:false,
  purchaseVerified:false,decoderVersion:'pump-fun-legacy-buy-payload-v1'};
}
