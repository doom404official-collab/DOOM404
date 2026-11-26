import {PublicKey} from '@solana/web3.js';
// Base facts survive unsupported extension layouts; no absence claim is made.
export function mintBaseObservation(account){
 try{
  const b=account.data;if(!Buffer.isBuffer(b)||b.length<82||b.length===355||b[45]!==1)return null;
  if(b.length>82&&(b.length<166||b[165]!==1||b.subarray(82,165).some(x=>x!==0)))return null;
  const optional=o=>{const n=b.readUInt32LE(o);if(n>1)throw Error();const v=b.subarray(o+4,o+36);if(!n&&v.some(x=>x!==0))throw Error();return n?new PublicKey(v).toBase58():null;};
  return {isInitialized:true,mintAuthority:optional(0),freezeAuthority:optional(46),supply:b.readBigUInt64LE(36).toString(),decimals:b[44],extensions:null};
 }catch{return null;}
}
