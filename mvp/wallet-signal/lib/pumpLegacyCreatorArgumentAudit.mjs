import { createHash } from "node:crypto";
import { PublicKey } from "@solana/web3.js";
import { PUMP_PROGRAM_ID } from "./pumpFunCreation.mjs";
const alphabet="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function decode58(s){let n=0n;for(const c of s){const i=alphabet.indexOf(c);if(i<0)throw Error("INVALID_BASE58");n=n*58n+BigInt(i);}let h=n.toString(16);if(h.length%2)h="0"+h;return Buffer.concat([Buffer.alloc((s.match(/^1*/)||[""])[0].length),n===0n?Buffer.alloc(0):Buffer.from(h,"hex")]);}
function readString(b,o,max){if(o+4>b.length)throw Error("TRUNCATED_STRING");const n=b.readUInt32LE(o);o+=4;if(n>max||o+n>b.length)throw Error("INVALID_STRING_LENGTH");new TextDecoder("utf-8",{fatal:true}).decode(b.subarray(o,o+n));return o+n;}
const disc=createHash("sha256").update("global:create").digest().subarray(0,8);
const key=x=>typeof x==="string"?x:x?.pubkey?.toString?.()||null;
/** Diagnostic only. Never promotes attribution. */
export function auditLegacyCreatorArguments({mint,transaction,indexedCreator}){
 const keys=(transaction?.transaction?.message?.accountKeys||[]).map(key);
 const instructions=[...(transaction?.transaction?.message?.instructions||[]),...(transaction?.meta?.innerInstructions||[]).flatMap(g=>g.instructions||[])];
 return instructions.flatMap(ix=>{
  const program=key(ix?.programId)||(Number.isInteger(ix?.programIdIndex)?keys[ix.programIdIndex]:null);
  if(program!==PUMP_PROGRAM_ID||typeof ix.data!=="string")return [];
  let bytes;try{bytes=decode58(ix.data);}catch{return [];}
  if(bytes.length<8||!bytes.subarray(0,8).equals(disc))return [];
  const accounts=(ix.accounts||[]).map(x=>Number.isInteger(x)?keys[x]:key(x));
  if(accounts[0]!==mint)return [];
  let creator=null,reason=null,remainingBytes=null,argumentLengths=[];
  try{
   let offset=8;
   for(const max of [32,13,200]){const start=offset;offset=readString(bytes,offset,max);argumentLengths.push(offset-start-4);}
   if(offset+32>bytes.length)throw Error("CREATOR_TRUNCATED");
   creator=new PublicKey(bytes.subarray(offset,offset+32)).toBase58();offset+=32;
   remainingBytes=bytes.length-offset;
   if(remainingBytes!==0)reason="UNEXPECTED_TRAILING_BYTES";
  }catch(e){reason=["TRUNCATED_STRING","INVALID_STRING_LENGTH","CREATOR_TRUNCATED"].includes(e?.message)?e.message:"ARGUMENT_PARSE_FAILED";}
  return [{accountCount:accounts.length,dataBytes:bytes.length,argumentLengths,creator,
   indexedCreatorMatched:creator===indexedCreator,remainingBytes,reason,verified:false}];
 });
}
