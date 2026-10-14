import { createHash } from "node:crypto";
import { createSolanaRpcAdapter } from "../lib/creatorOriginRpc.mjs";
import { verifyLaunchpadCreation } from "../lib/launchpadCreationVerifier.mjs";
import { pumpFunDecoders, PUMP_PROGRAM_ID } from "../lib/pumpFunCreation.mjs";

// Read-only secondary parser; not independent provider or human review.
const mint="98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump";
const signature="KMoj9pQq8XncaZPHQ5bTNZPDgQwfCBgdihVkxc5Y27fh7iGYwMbti2Mcscprhia1NBJauBbEvs5DE8ooWKWg6bs";
const indexed="6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC";
const alphabet="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function from58(s){let n=0n;for(const ch of s){const i=alphabet.indexOf(ch);if(i<0)throw Error("INVALID_BASE58");n=n*58n+BigInt(i);}let h=n.toString(16);if(h.length%2)h="0"+h;return Buffer.concat([Buffer.alloc((s.match(/^1*/) || [""])[0].length),n===0n?Buffer.alloc(0):Buffer.from(h,"hex")]);}
function to58(bytes){let n=BigInt("0x"+Buffer.from(bytes).toString("hex"));let s="";while(n>0n){s=alphabet[Number(n%58n)]+s;n/=58n;}for(const b of bytes){if(b!==0)break;s="1"+s;}return s||"1";}
function secondaryCreator(tx){
 const msg=tx?.transaction?.message;
 const keys=(msg?.accountKeys||[]).map(x=>typeof x==="string"?x:x?.pubkey?.toString?.());
 const instructions=[...(msg?.instructions||[]),...(tx?.meta?.innerInstructions||[]).flatMap(x=>x.instructions||[])];
 const discriminator=createHash("sha256").update("global:create_v2").digest().subarray(0,8);
 const found=[];
 for(const ix of instructions){
  const program=ix.programId?.toString?.()||(Number.isInteger(ix.programIdIndex)?keys[ix.programIdIndex]:null);
  if(program!==PUMP_PROGRAM_ID||typeof ix.data!=="string"||!Array.isArray(ix.accounts))continue;
  const accounts=ix.accounts.map(x=>Number.isInteger(x)?keys[x]:typeof x==="string"?x:x?.toString?.());
  if(accounts[0]!==mint)continue;
  const bytes=from58(ix.data);
  if(!bytes.subarray(0,8).equals(discriminator))continue;
  let p=8;
  for(const max of [32,13,200]){
   if(p+4>bytes.length)throw Error("TRUNCATED_ARGUMENT");
   const len=bytes.readUInt32LE(p);p+=4;
   if(len>max||p+len>bytes.length)throw Error("INVALID_CREATE_ARGUMENT");
   p+=len;
  }
  if(p+32>bytes.length)throw Error("TRUNCATED_CREATOR");
  found.push(to58(bytes.subarray(p,p+32)));
 }
 return [...new Set(found)];
}
let output={status:"UNRESOLVED",writeAttempted:false,independentlyReviewed:false};
try{
 const rpc=createSolanaRpcAdapter({rpcUrl:process.env.HELIUS_RPC_URL,maxRequests:3,maxRetries:1});
 const tx=await rpc.fetchTransaction(signature);
 const original=verifyLaunchpadCreation({mint,signature,transaction:tx,decoders:pumpFunDecoders});
 const role=original.decodedRoles?.find(x=>x.role==="launchpad_creator");
 const secondary=secondaryCreator(tx);
 const match=original.status==="VERIFIED"&&role&&secondary.length===1&&secondary[0]===role.address;
 output={status:match?"DECODERS_AGREE":"DECODER_DISAGREEMENT",signature,mint,
  primaryCreator:role?.address||null,secondaryCreator:secondary.length===1?secondary[0]:null,
  indexedCandidate:indexed,indexedMatch:match?role.address===indexed:false,
  programId:role?.programId||null,decoderVersion:role?.decoderVersion||null,
  independentlyReviewed:false,writeAttempted:false};
}catch(e){output={status:"UNRESOLVED",reason:"READ_ONLY_CORROBORATION_FAILED",writeAttempted:false,independentlyReviewed:false};}
console.log(JSON.stringify(output));
process.exitCode=output.status==="DECODERS_AGREE"?0:2;
