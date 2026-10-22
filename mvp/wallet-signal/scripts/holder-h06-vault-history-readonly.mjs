// H06 exact-slot historical pool/vault corroboration. Read-only; fail closed.
import {createHash} from "node:crypto";
const endpoint=process.env.ALCHEMY_SOLANA_ARCHIVE_RPC_URL;
if(!endpoint?.startsWith("https://"))throw Error("ALCHEMY_ARCHIVE_NOT_CONFIGURED");
const pool="6e3jZLtf4tQbWZm3f7A66jF8tfZn6MRQVrbDFgcNWarA";
const expectedBase="98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump";
const expectedQuote="So11111111111111111111111111111111111111112";
const expectedVaults=["F1Gw5qjivGuLcTsUBeq7ztzE4mi9uaDm7vQdz9sB9mp8","78nPA3tUEH4b2jZjH1JKdqXjykYWzA7Az37CeKj1tTcg"];
const program="pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";
const tokenPrograms=new Set(["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA","TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"]);
const alphabet="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58(bytes){let n=0n;for(const b of bytes)n=(n<<8n)+BigInt(b);let out="";while(n){out=alphabet[Number(n%58n)]+out;n/=58n;}for(const b of bytes){if(b!==0)break;out="1"+out;}return out||"1";}
async function read(address,slot){
 const response=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:slot,method:"getAccountInfo",params:[address,{encoding:"base64",slot}]}),signal:AbortSignal.timeout(15000)});
 const json=await response.json();
 if(!response.ok||json.error)return {status:"PROVIDER_ERROR",errorCode:json.error?.code??response.status};
 const v=json.result?.value;
 if(!v||v.data?.[1]!=="base64")return {status:"ACCOUNT_UNAVAILABLE",contextSlot:json.result?.context?.slot??null};
 const bytes=Buffer.from(v.data[0],"base64");
 return {status:"OBSERVED",contextSlot:json.result?.context?.slot??null,ownerProgram:v.owner,length:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex"),bytes};
}
const results=[];
for(const slot of [450097547,451211747,457305617]){
 const p=await read(pool,slot);
 if(p.status!=="OBSERVED"||p.contextSlot!==slot||p.ownerProgram!==program||p.length<243||!p.bytes.subarray(0,8).equals(Buffer.from([241,154,109,4,17,177,109,188]))){results.push({slot,status:"POOL_UNVERIFIED",contextSlot:p.contextSlot??null,errorCode:p.errorCode??null});continue;}
 const field=o=>base58(p.bytes.subarray(o,o+32));
 const decoded={baseMint:field(43),quoteMint:field(75),lpMint:field(107),baseVault:field(139),quoteVault:field(171)};
 const vaults=[];
 for(const [address,mint] of [[decoded.baseVault,decoded.baseMint],[decoded.quoteVault,decoded.quoteMint]]){
  const a=await read(address,slot);
  const valid=a.status==="OBSERVED"&&a.contextSlot===slot&&tokenPrograms.has(a.ownerProgram)&&a.length>=165;
  vaults.push({address,status:a.status,contextSlot:a.contextSlot??null,ownerProgram:a.ownerProgram??null,sha256:a.sha256??null,mintMatches:valid?base58(a.bytes.subarray(0,32))===mint:false,authorityMatches:valid?base58(a.bytes.subarray(32,64))===pool:false,rawBalance:valid?a.bytes.readBigUInt64LE(64).toString():null});
 }
 const mappingMatches=decoded.baseMint===expectedBase&&decoded.quoteMint===expectedQuote&&decoded.baseVault===expectedVaults[0]&&decoded.quoteVault===expectedVaults[1];
 results.push({slot,status:"OBSERVED_ONLY",contextSlot:p.contextSlot,poolSha256:p.sha256,poolOwnerMatches:true,poolDiscriminatorMatches:true,decoded,mappingMatches,vaults,historicalStateVerified:false});
}
console.log(JSON.stringify({status:"OBSERVED_ONLY",provider:"alchemy",results,scorePromoted:false,checkpointModified:false}));
