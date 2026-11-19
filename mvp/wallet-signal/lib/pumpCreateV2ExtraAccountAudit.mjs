import { createHash } from "node:crypto";
import { PublicKey } from "@solana/web3.js";
import { PUMP_PROGRAM_ID } from "./pumpFunCreation.mjs";

const alphabet="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function decode58(value){
 let n=0n;for(const ch of value){const i=alphabet.indexOf(ch);if(i<0)throw Error("INVALID_BASE58");n=n*58n+BigInt(i);}
 let hex=n.toString(16);if(hex.length%2)hex="0"+hex;
 return Buffer.concat([Buffer.alloc((value.match(/^1*/)||[""])[0].length),
 n===0n?Buffer.alloc(0):Buffer.from(hex,"hex")]);
}
function readString(bytes,offset,max){
 if(offset+4>bytes.length)throw Error("TRUNCATED");
 const n=bytes.readUInt32LE(offset);offset+=4;
 if(n>max||offset+n>bytes.length)throw Error("INVALID_LENGTH");
 new TextDecoder("utf-8",{fatal:true}).decode(bytes.subarray(offset,offset+n));
 return offset+n;
}
const disc=createHash("sha256").update("global:create_v2").digest().subarray(0,8);
const key=x=>typeof x==="string"?x:x?.pubkey?.toString?.()||null;
/** Strict diagnostic only. Does not accept a 20-account instruction as verified. */
export function auditCreateV2ExtraAccount({mint,transaction,indexedCreator}){
 const keys=(transaction?.transaction?.message?.accountKeys||[]).map(key);
 const instructions=[...(transaction?.transaction?.message?.instructions||[]),
 ...(transaction?.meta?.innerInstructions||[]).flatMap(x=>x.instructions||[])];
 const out=[];
 for(const ix of instructions){
  const program=key(ix?.programId)||(Number.isInteger(ix?.programIdIndex)?keys[ix.programIdIndex]:null);
  if(program!==PUMP_PROGRAM_ID||typeof ix.data!=="string")continue;
  const bytes=decode58(ix.data);
  if(bytes.length<8||!bytes.subarray(0,8).equals(disc))continue;
  const accounts=(ix.accounts||[]).map(x=>Number.isInteger(x)?keys[x]:key(x));
  if(accounts.length!==20||accounts[0]!==mint)continue;
  let creator=null,argumentParse="FAILED",remainingBytes=null;
  try{
   let offset=8;for(const max of [32,13,200])offset=readString(bytes,offset,max);
   creator=new PublicKey(bytes.subarray(offset,offset+32)).toBase58();offset+=32;
   if(![0,1].includes(bytes[offset]))throw Error("INVALID_FLAG");
   offset++;
   // Parse optional trailing fields according to current decoder contract.
   if(offset<bytes.length){if(bytes[offset++]!==0)throw Error("INVALID_CASHBACK");}
   if(offset<bytes.length){if(offset+8>bytes.length)throw Error("TRUNCATED_FEE");offset+=8;}
   if(offset<bytes.length){if(![0,1].includes(bytes[offset++]))throw Error("INVALID_REWARD");}
   remainingBytes=bytes.length-offset;
   argumentParse=remainingBytes===0?"COMPLETE":"TRAILING_BYTES";
  }catch{argumentParse="FAILED";}
  const [quoteMint,quoteAta,quoteProgram,extra]=accounts.slice(16);
  let quoteAtaDerivation=null;
  try{
   const [ata]=PublicKey.findProgramAddressSync(
    [new PublicKey(accounts[2]).toBuffer(),new PublicKey(quoteProgram).toBuffer(),new PublicKey(quoteMint).toBuffer()],
    new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"));
   quoteAtaDerivation=ata.toBase58()===quoteAta;
  }catch{quoteAtaDerivation=false;}
  out.push({accountCount:20,mintMatched:true,creator,
   indexedCreatorMatched:creator===indexedCreator,
   argumentParse,remainingBytes,quoteMint,quoteAta,quoteProgram,extra,
   quoteAtaDerivation,extraMatchesKnownCoreAccount:accounts.slice(0,16).includes(extra),
   extraIsSigner:transaction?.transaction?.message?.accountKeys?.some(k=>key(k)===extra&&k?.signer===true)||false,
   acceptedByDecoder:false});
 }
 return out;
}
