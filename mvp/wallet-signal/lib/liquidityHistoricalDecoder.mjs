import {createHash} from "node:crypto";
export const HISTORY_CLASSIFICATION="AMOUNT_RECONCILED_AUTHORIZATION_PENDING";
export const PUMP_AMM_PROGRAM="pAMMBay6oceH9fJKBRHGP5D4bD4sWpmqffYFZJ9xg";
export const HISTORICAL_NAMES=["set_coin_creator","migrate_pool_coin_creator","admin_set_coin_creator","admin_cto_pool","collect_coin_creator_fee","transfer_creator_fees_to_pump","transfer_creator_fees_to_pump_v2"];
export function anchorDiscriminator(name){return createHash("sha256").update("global:"+name).digest().subarray(0,8).toString("hex");}
const candidates=new Map(HISTORICAL_NAMES.map(n=>[anchorDiscriminator(n),n]));
export function decodeHistoricalCandidate(instruction,signature,slot,provider){
 if(instruction?.programId!==PUMP_AMM_PROGRAM)return null;
 // Only the first eight bytes identify a candidate; the remaining accounts and authorization are NOT validated.
 let name=null,coverage=null;
 if(typeof instruction?.parsed?.type==="string"&&HISTORICAL_NAMES.includes(instruction.parsed.type)){
   name=instruction.parsed.type;coverage="parsed_instruction_only";
 }else if(typeof instruction?.data==="string"){
   // Solana JSON parsed responses encode unknown program instruction data as base58.
   const bytes=decodeBase58(instruction.data);
   if(bytes.length>=8){name=candidates.get(Buffer.from(bytes.subarray(0,8)).toString("hex"))||null;coverage="anchor_discriminator_only";}
 }
 if(!name)return null;
 return {signature,slot,provider,operation:name,programId:instruction.programId,rawInstruction:instruction,authorizationVerified:false,classification:"UNVERIFIED_CANDIDATE",decoderCoverage:coverage,accountRolesVerified:false,signerAuthorizationVerified:false};
}
function decodeBase58(input){
 const alphabet="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
 let num=0n;
 for(const char of input){const i=alphabet.indexOf(char);if(i<0)return new Uint8Array();num=num*58n+BigInt(i);}
 const values=[];
 while(num>0n){values.unshift(Number(num&255n));num>>=8n;}
 for(const char of input){if(char!=="1")break;values.unshift(0);}
 return Uint8Array.from(values);
}
export function validateHistoryCheckpoint(prior,pool){
 if(!prior||prior.schemaVersion!==1||prior.pool!==pool||prior.classification!==HISTORY_CLASSIFICATION||!Array.isArray(prior.seen)||!Array.isArray(prior.events)||!Array.isArray(prior.pendingSignatures||[]))throw Error("INVALID_HISTORY_CHECKPOINT");
 if(prior.complete&&((prior.pendingSignatures||[]).length>0))throw Error("INVALID_COMPLETE_HISTORY_CHECKPOINT");
 return prior;
}
