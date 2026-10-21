import {PublicKey} from '@solana/web3.js';
import {createHash} from 'node:crypto';
import {PUMP_GLOBAL_SCHEMA_FIELDS,expectedPinnedGlobalBytes,PUMP_GLOBAL_SCHEMA_COMMIT} from './pumpFunPinnedGlobalSchema.mjs';
const discriminator=createHash('sha256').update('account:Global').digest().subarray(0,8);
/** Candidate-only decode. Never authorizes historical fee roles or ledger promotion. */
export function decodePinnedGlobalCandidate(bytes){
 const fail=reason=>({status:'CANDIDATE_REJECTED',reason,layoutVersionVerified:false,historicalStateVerified:false,feeRecipientRolesVerified:false,eligibleForLivePromotion:false});
 if(!Buffer.isBuffer(bytes)||bytes.length!==expectedPinnedGlobalBytes())return fail('ACCOUNT_LENGTH_MISMATCH');
 if(!bytes.subarray(0,8).equals(discriminator))return fail('GLOBAL_DISCRIMINATOR_MISMATCH');
 let offset=8;const fields={};
 for(const [name,type] of PUMP_GLOBAL_SCHEMA_FIELDS){
  const read=t=>{
   if(t==='bool'){const value=bytes[offset++];if(value!==0&&value!==1)throw Error('INVALID_BOOL');return Boolean(value);}
   if(t==='u64'){const value=bytes.readBigUInt64LE(offset).toString();offset+=8;return value;}
   if(t==='pubkey'){const value=new PublicKey(bytes.subarray(offset,offset+32)).toBase58();offset+=32;return value;}
   if(t&&Array.isArray(t.array)){const [item,count]=t.array;return Array.from({length:count},()=>read(item));}
   throw Error('UNSUPPORTED_TYPE');
  };
  try{fields[name]=read(type);}catch{return fail('INVALID_FIELD_ENCODING');}
 }
 if(offset!==bytes.length)return fail('UNCONSUMED_BYTES');
 return {status:'CANDIDATE_DECODED_UNVERIFIED',schemaCommit:PUMP_GLOBAL_SCHEMA_COMMIT,accountDataBytes:bytes.length,accountDataSha256:createHash('sha256').update(bytes).digest('hex'),fields,layoutVersionVerified:false,historicalStateVerified:false,feeRecipientRolesVerified:false,eligibleForLivePromotion:false};
}
