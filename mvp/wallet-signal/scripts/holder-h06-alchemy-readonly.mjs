// H06: bounded historical account-state audit; no writes or score changes.
import {createHash} from "node:crypto";
const endpoint=process.env.ALCHEMY_SOLANA_ARCHIVE_RPC_URL;
if(!endpoint?.startsWith("https://"))throw Error("ALCHEMY_ARCHIVE_NOT_CONFIGURED");
const pool="6e3jZLtf4tQbWZm3f7A66jF8tfZn6MRQVrbDFgcNWarA";
const slots=[450097547,451211747,457305617];
const program="pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";
const disc=Buffer.from([241,154,109,4,17,177,109,188]);
const results=[];
for(const slot of slots){
 const response=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:slot,method:"getAccountInfo",params:[pool,{encoding:"base64",slot}]}),signal:AbortSignal.timeout(15000)});
 const json=await response.json();
 if(!response.ok||json.error){results.push({slot,status:"PROVIDER_ERROR",code:json.error?.code??response.status,historicalStateVerified:false});continue;}
 const value=json.result?.value;
 const raw=value?.data?.[1]==="base64"?Buffer.from(value.data[0],"base64"):null;
 const ownerMatches=value?.owner===program;
 const discriminatorMatches=Boolean(raw&&raw.length>=8&&raw.subarray(0,8).equals(disc));
 results.push({slot,contextSlot:json.result?.context?.slot??null,accountPresent:Boolean(value),ownerMatches,discriminatorMatches,bytes:raw?.length??null,sha256:raw?createHash("sha256").update(raw).digest("hex"):null,historicalStateVerified:false,verificationNote:"Alchemy Account Archive exact-slot semantics and endpoint entitlement must be independently established; contextSlot alone is insufficient."});
}
console.log(JSON.stringify({status:"OBSERVED_ONLY",provider:"alchemy",pool,results,scorePromoted:false,checkpointModified:false}));
