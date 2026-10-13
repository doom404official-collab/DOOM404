/** Classify why a historical transaction did not verify as Pump.fun creation.
 * No raw instruction bytes, provider secrets or wallet holdings are returned.
 */
import { createHash } from "node:crypto";
import { PUMP_PROGRAM_ID } from "./pumpFunCreation.mjs";
const ALPHABET="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58Prefix(value) {
  if(typeof value!=="string") return null;
  let n=0n;
  for(const char of value){const i=ALPHABET.indexOf(char);if(i<0)return null;n=n*58n+BigInt(i);}
  let hex=n.toString(16);if(hex.length%2)hex="0"+hex;
  const zeroes=(value.match(/^1*/)||[""])[0].length;
  const bytes=Buffer.concat([Buffer.alloc(zeroes),n===0n?Buffer.alloc(0):Buffer.from(hex,"hex")]);
  return bytes.length>=8?bytes.subarray(0,8).toString("hex"):null;
}
const discriminators=new Set(["create","create_v2"].map(name=>createHash("sha256").update("global:"+name).digest("hex").slice(0,16)));
export function classifyCreatorCandidate(tx,mint){
  if(!tx)return "TRANSACTION_UNAVAILABLE";
  if(tx.meta?.err!=null)return "TRANSACTION_FAILED";
  const keys=(tx.transaction?.message?.accountKeys||[]).map(x=>typeof x==="string"?x:x?.pubkey);
  const outer=tx.transaction?.message?.instructions||[];
  const inner=(tx.meta?.innerInstructions||[]).flatMap(x=>x.instructions||[]);
  const instructions=[...outer,...inner];
  let pump=0,recognized=0,mintMentioned=false;
  for(const ix of instructions){
    const program=ix?.programId||(Number.isInteger(ix?.programIdIndex)?keys[ix.programIdIndex]:null);
    if(program!==PUMP_PROGRAM_ID)continue;
    pump++;
    const accounts=(ix.accounts||[]).map(x=>Number.isInteger(x)?keys[x]:typeof x==="string"?x:x?.pubkey);
    if(accounts.includes(mint))mintMentioned=true;
    if(discriminators.has(base58Prefix(ix.data)))recognized++;
  }
  if(!pump)return "NO_PUMP_PROGRAM_INSTRUCTION";
  if(!recognized)return "PUMP_PROGRAM_NON_CREATION_OR_UNPARSED";
  if(!mintMentioned)return "CREATION_DISCRIMINATOR_OTHER_MINT";
  return "CREATION_DISCRIMINATOR_PRESENT_DECODER_REJECTED";
}
