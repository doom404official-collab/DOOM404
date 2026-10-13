import { createHash } from "node:crypto";
import { PUMP_PROGRAM_ID } from "./pumpFunCreation.mjs";
const alphabet="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function prefix(data) {
  if(typeof data!=="string"||!data)return null;
  let n=0n;
  for(const ch of data){const i=alphabet.indexOf(ch);if(i<0)return null;n=n*58n+BigInt(i);}
  let hex=n.toString(16);if(hex.length%2)hex="0"+hex;
  const bytes=Buffer.concat([Buffer.alloc((data.match(/^1*/)||[""])[0].length),
    n===0n?Buffer.alloc(0):Buffer.from(hex,"hex")]);
  return bytes.length>=8?bytes.subarray(0,8).toString("hex"):null;
}
const disc=Object.fromEntries(["create","create_v2"].map(k=>[
  createHash("sha256").update("global:"+k).digest("hex").slice(0,16),k]));
const key=x=>typeof x==="string"?x:x?.pubkey?.toString?.()||null;
/** Diagnostic only: reports structural conditions, never promotes attribution. */
export function inspectPumpCreationLayout({mint,transaction}) {
  const keys=(transaction?.transaction?.message?.accountKeys||[]).map(key);
  const outer=transaction?.transaction?.message?.instructions||[];
  const inner=(transaction?.meta?.innerInstructions||[]).flatMap(x=>x.instructions||[]);
  return [...outer,...inner].flatMap(ix=>{
    const program=key(ix?.programId)||(Number.isInteger(ix?.programIdIndex)?keys[ix.programIdIndex]:null);
    if(program!==PUMP_PROGRAM_ID)return [];
    const kind=disc[prefix(ix.data)]||null;
    if(!kind)return [];
    const accounts=(ix.accounts||[]).map(x=>Number.isInteger(x)?keys[x]:key(x));
    const expected=kind==="create_v2"?{
      system:accounts[6]==="11111111111111111111111111111111",
      token2022:accounts[7]==="TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
      ata:accounts[8]==="ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
      program:accounts[15]===PUMP_PROGRAM_ID
    }:{
      system:accounts[8]==="11111111111111111111111111111111",
      token:accounts[9]==="TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
      ata:accounts[10]==="ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
      program:accounts[13]===PUMP_PROGRAM_ID
    };
    return [{kind,accountCount:accounts.length,mintAtFirstAccount:accounts[0]===mint,
      mintAppears:accounts.includes(mint),allAccountsResolved:accounts.every(Boolean),
      existingDecoderCountAllowed:kind==="create_v2"?[16,19].includes(accounts.length):accounts.length===14,
      expectedPositionChecks:expected,hasData:typeof ix.data==="string"}];
  });
}
