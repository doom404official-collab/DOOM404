import { createHash } from "node:crypto";
import { PublicKey } from "@solana/web3.js";
import { createSolanaRpcAdapter } from "../lib/creatorOriginRpc.mjs";
import { createIntelligenceVault } from "../lib/intelligenceVault.mjs";
import { PUMP_PROGRAM_ID } from "../lib/pumpFunCreation.mjs";

const mint=process.env.CREATOR_DIAGNOSTIC_MINT||"";
const signature="aLBaPgDsc5x6FgpirNJnmgFEjfz2DveHQ3xaKYeypdZq26WiYt7wjoVfNqgWMfiKR6DYveZmGiYAnN6Y593SXZ7";
const enabled=process.env.VERCEL_ENV==="preview"&&
 process.env.VERCEL_GIT_COMMIT_REF==="feature/creator-origin-cb02e"&&
 process.env.CREATOR_ARGUMENT_AUDIT_ONCE==="true";
const alphabet="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function decode58(str){
 let n=0n;for(const ch of str){const i=alphabet.indexOf(ch);if(i<0)throw Error("BAD_BASE58");n=n*58n+BigInt(i);}
 let hex=n.toString(16);if(hex.length%2)hex="0"+hex;
 return Buffer.concat([Buffer.alloc((str.match(/^1*/)||[""])[0].length),
  n===0n?Buffer.alloc(0):Buffer.from(hex,"hex")]);
}
function readString(bytes,offset,max){
 if(offset+4>bytes.length)throw Error("TRUNCATED_STRING");
 const n=bytes.readUInt32LE(offset);offset+=4;
 if(n>max||offset+n>bytes.length)throw Error("BAD_STRING_LENGTH");
 new TextDecoder("utf-8",{fatal:true}).decode(bytes.subarray(offset,offset+n));
 return offset+n;
}
if(!enabled)console.log("CREATOR_ARGUMENT_AUDIT: SKIPPED_NOT_OPTED_IN");
else if(!process.env.HELIUS_RPC_URL||!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)
 console.log("CREATOR_ARGUMENT_AUDIT: MISSING_CONFIGURATION");
else{
 try{
  const vault=createIntelligenceVault({url:process.env.SUPABASE_URL,serviceRoleKey:process.env.SUPABASE_SERVICE_ROLE_KEY});
  const cp=await vault.getCheckpoint(mint);
  if(!cp?.inspectedSignatures?.includes(signature))throw Error("SIGNATURE_NOT_IN_CHECKPOINT");
  const rpc=createSolanaRpcAdapter({rpcUrl:process.env.HELIUS_RPC_URL,maxRequests:3,maxRetries:1,minIntervalMs:500});
  const tx=await rpc.fetchTransaction(signature);
  const keys=(tx?.transaction?.message?.accountKeys||[]).map(x=>typeof x==="string"?x:x?.pubkey);
  const instructions=[...(tx?.transaction?.message?.instructions||[]),...(tx?.meta?.innerInstructions||[]).flatMap(x=>x.instructions||[])];
  const expected=createHash("sha256").update("global:create_v2").digest().subarray(0,8);
  const candidates=[];
  for(const ix of instructions){
   const program=ix?.programId||(Number.isInteger(ix?.programIdIndex)?keys[ix.programIdIndex]:null);
   if(program!==PUMP_PROGRAM_ID||typeof ix.data!=="string")continue;
   const bytes=decode58(ix.data);
   if(!bytes.subarray(0,8).equals(expected))continue;
   const accounts=(ix.accounts||[]).map(x=>Number.isInteger(x)?keys[x]:typeof x==="string"?x:x?.pubkey);
   let creator=null,argumentValid=false,reason=null;
   try{
    let off=8;
    for(const max of [32,13,200])off=readString(bytes,off,max);
    if(off+33>bytes.length)throw Error("CREATOR_OR_FLAG_TRUNCATED");
    creator=new PublicKey(bytes.subarray(off,off+32)).toBase58();
    off+=32;
    const mode=bytes[off++];
    if(mode!==0&&mode!==1)throw Error("INVALID_MAYHEM_FLAG");
    argumentValid=true;
   }catch(e){reason=["TRUNCATED_STRING","BAD_STRING_LENGTH","CREATOR_OR_FLAG_TRUNCATED","INVALID_MAYHEM_FLAG"].includes(e.message)?e.message:"ARGUMENT_PARSE_FAILED";}
   candidates.push({accountCount:accounts.length,mintMatched:accounts[0]===mint,
    creator,argumentPrefixValid:argumentValid,reason,
    trailingAccounts:accounts.slice(16),extraAccountCount:Math.max(0,accounts.length-19)});
  }
  console.log("CREATOR_ARGUMENT_AUDIT:",JSON.stringify({
   status:"DIAGNOSTIC_ONLY",signature,candidates,creatorVerified:false
  }));
 }catch(e){console.log("CREATOR_ARGUMENT_AUDIT:",JSON.stringify({
  status:"UNRESOLVED",reason:["RPC_RATE_LIMITED","SIGNATURE_NOT_IN_CHECKPOINT"].includes(e?.message)?e.message:"AUDIT_FAILED"
 }));}
}
