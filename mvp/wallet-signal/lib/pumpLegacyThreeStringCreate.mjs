import { createHash } from "node:crypto";
import { PUMP_PROGRAM_ID } from "./pumpFunCreation.mjs";
const alphabet="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const disc=createHash("sha256").update("global:create").digest().subarray(0,8);
const key=x=>typeof x==="string"?x:x?.pubkey?.toString?.()||null;
function decode58(s){
 if(typeof s!=="string"||!s)return null;
 let n=0n;for(const c of s){const i=alphabet.indexOf(c);if(i<0)return null;n=n*58n+BigInt(i);}
 let h=n.toString(16);if(h.length%2)h="0"+h;
 return Buffer.concat([Buffer.alloc((s.match(/^1*/)||[""])[0].length),n===0n?Buffer.alloc(0):Buffer.from(h,"hex")]);
}
function readString(b,o,max){
 if(o+4>b.length)throw Error("TRUNCATED_STRING");
 const n=b.readUInt32LE(o);o+=4;
 if(n>max||o+n>b.length)throw Error("INVALID_STRING_LENGTH");
 new TextDecoder("utf-8",{fatal:true}).decode(b.subarray(o,o+n));
 return o+n;
}
/** Historical candidate only: never returns verified creator attribution. */
export function inspectLegacyThreeStringCreate({mint,transaction,indexedCreator}){
 const msg=transaction?.transaction?.message||{};
 const keys=(msg.accountKeys||[]).map(key);
 const instructions=[...(msg.instructions||[]),...(transaction?.meta?.innerInstructions||[]).flatMap(g=>g.instructions||[])];
 const results=[];
 for(const ix of instructions){
  const program=key(ix?.programId)||(Number.isInteger(ix?.programIdIndex)?keys[ix.programIdIndex]:null);
  if(program!==PUMP_PROGRAM_ID||!Array.isArray(ix.accounts)||ix.accounts.length!==14)continue;
  const accounts=ix.accounts.map(a=>Number.isInteger(a)?keys[a]:key(a));
  if(accounts[0]!==mint)continue;
  let bytes;try{bytes=decode58(ix.data);}catch{continue;}
  if(!bytes||bytes.length<8||!bytes.subarray(0,8).equals(disc))continue;
  let exactlyThreeStrings=false;
  try{let o=8;for(const max of [32,13,200])o=readString(bytes,o,max);exactlyThreeStrings=o===bytes.length;}catch{}
  const user=accounts[7];
  const messageSigner=msg.accountKeys?.some(k=>typeof k==="object"&&key(k)===user&&k.signer===true)||false;
  results.push({kind:"legacy_create_three_strings",mintMatched:true,accountCount:14,
   exactlyThreeStrings,userAccount:user,indexedCreatorMatchesUser:user===indexedCreator,
   messageSigner,creatorArgumentPresent:!exactlyThreeStrings,
   status:"HISTORICAL_CREATOR_ROLE_UNVERIFIED",verified:false});
 }
 return results;
}
