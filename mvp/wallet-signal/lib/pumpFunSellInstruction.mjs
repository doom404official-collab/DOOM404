import {createHash} from 'node:crypto';
import {PUMP_FUN_PROGRAM_ID} from './pumpFunSellCandidates.mjs';
const ALPHABET='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function decode58(value){
 if(typeof value!=='string'||!value)return null;
 let n=0n;
 for(const c of value){const i=ALPHABET.indexOf(c);if(i<0)return null;n=n*58n+BigInt(i);}
 let hex=n.toString(16);if(hex.length%2)hex='0'+hex;
 return Buffer.concat([Buffer.alloc((value.match(/^1*/)||[''])[0].length),n===0n?Buffer.alloc(0):Buffer.from(hex,'hex')]);
}
const SELL_DISCRIMINATOR=createHash('sha256').update('global:sell').digest().subarray(0,8);
/** Parse only the legacy Pump.fun sell instruction payload.
 * This is a candidate, not a verified sale; wallet/asset-flow checks remain required.
 */
export function decodePumpFunSellInstruction({instruction,programId}={}){
 if(programId!==PUMP_FUN_PROGRAM_ID)return null;
 const bytes=decode58(instruction?.data);
 if(!bytes||bytes.length!==24||!bytes.subarray(0,8).equals(SELL_DISCRIMINATOR))return null;
 const tokenAmount=bytes.readBigUInt64LE(8);
 const minSolOutput=bytes.readBigUInt64LE(16);
 if(tokenAmount===0n)return null;
 return {kind:'PUMP_FUN_SELL_CANDIDATE',soldRaw:tokenAmount.toString(),
  minSolOutputLamports:minSolOutput.toString(),instructionVerified:false,saleVerified:false,
  decoderVersion:'pump-fun-legacy-sell-payload-v1'};
}
