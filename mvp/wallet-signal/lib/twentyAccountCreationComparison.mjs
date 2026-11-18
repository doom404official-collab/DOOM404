import { createHash } from "node:crypto";
import { PUMP_PROGRAM_ID } from "./pumpFunCreation.mjs";
const alphabet="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const disc=createHash("sha256").update("global:create_v2").digest().subarray(0,8).toString("hex");
function prefix(data){
 if(typeof data!=="string")return null;
 let n=0n;for(const c of data){const i=alphabet.indexOf(c);if(i<0)return null;n=n*58n+BigInt(i);}
 let hex=n.toString(16);if(hex.length%2)hex="0"+hex;
 const b=Buffer.concat([Buffer.alloc((data.match(/^1*/)||[""])[0].length),n===0n?Buffer.alloc(0):Buffer.from(hex,"hex")]);
 return b.length>=8?b.subarray(0,8).toString("hex"):null;
}
const key=x=>typeof x==="string"?x:x?.pubkey?.toString?.()||null;
/** Collect only 20-account create_v2 structural evidence. Never assert verified. */
export function summarizeTwentyAccountCreate({mint,signature,transaction}){
 const keys=(transaction?.transaction?.message?.accountKeys||[]).map(key);
 const instructions=[...(transaction?.transaction?.message?.instructions||[]),
 ...(transaction?.meta?.innerInstructions||[]).flatMap(g=>g.instructions||[])];
 return instructions.flatMap(ix=>{
  const program=key(ix?.programId)||(Number.isInteger(ix?.programIdIndex)?keys[ix.programIdIndex]:null);
  if(program!==PUMP_PROGRAM_ID||ix?.accounts?.length!==20||prefix(ix.data)!==disc)return [];
  const accounts=ix.accounts.map(x=>Number.isInteger(x)?keys[x]:key(x));
  return [{mint,signature,accountCount:20,mintMatched:accounts[0]===mint,
   quoteMint:accounts[16],quoteTokenProgram:accounts[18],extraAccount:accounts[19],
   corePositionsMatch:accounts[6]==="11111111111111111111111111111111"&&
    accounts[7]==="TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"&&
    accounts[15]===PUMP_PROGRAM_ID}];
 });
}
