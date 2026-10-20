import {PublicKey} from "@solana/web3.js";
const PROGRAM="pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";
const POOL=Buffer.from([241,154,109,4,17,177,109,188]);
const GLOBAL=Buffer.from([149,8,156,202,160,252,176,217]);
export function decodeArchivedPumpAccount(value,role){
 if(value?.owner!==PROGRAM||!Array.isArray(value?.data)||value.data[1]!=="base64")return {status:"INVALID_ACCOUNT_PROVENANCE"};
 let b;try{b=Buffer.from(value.data[0],"base64")}catch{return {status:"INVALID_ACCOUNT_BYTES"}}
 const disc=role==="pump_amm_pool"?POOL:role==="pump_amm_global_config"?GLOBAL:null;
 const min=role==="pump_amm_pool"?243:role==="pump_amm_global_config"?8+32+8+8+1+8*32:Infinity;
 if(!disc||b.length<min||!b.subarray(0,8).equals(disc))return {status:"INVALID_ACCOUNT_LAYOUT"};
 const pubkey=offset=>new PublicKey(b.subarray(offset,offset+32)).toBase58();
 if(role==="pump_amm_pool")return {status:"DECODED",role,coinCreator:pubkey(211),baseMint:pubkey(43),quoteMint:pubkey(75)};
 return {status:"DECODED",role,protocolFeeRecipients:Array.from({length:8},(_,i)=>pubkey(57+i*32))};
}
