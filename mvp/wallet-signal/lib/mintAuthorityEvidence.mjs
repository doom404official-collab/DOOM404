import {PublicKey} from '@solana/web3.js';

// Only an explicit RPC null proves revocation. Missing or malformed fields
// remain unknown; do not turn parse failures into a revoked authority.
export function normalizeMintAuthority(value) {
 if(value===null)return null;
 if(typeof value!=='string'||!value)return undefined;
 try {return new PublicKey(value).toBase58()===value?value:undefined;}
 catch {return undefined;}
}
export function mintAuthorityEvidence(info,{parsed=false}={}) {
 const read=key=>parsed&&info&&Object.hasOwn(info,key)?normalizeMintAuthority(info[key]):undefined;
 const mintAuthority=read('mintAuthority'),freezeAuthority=read('freezeAuthority');
 return {mintAuthority,freezeAuthority,
  authorityDetailsStatus:mintAuthority!==undefined&&freezeAuthority!==undefined?'available':'not_parsed'};
}
