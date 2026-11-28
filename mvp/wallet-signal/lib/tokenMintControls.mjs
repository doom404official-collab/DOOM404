import {PublicKey} from '@solana/web3.js';
// Mint-level configuration only. This does not certify individual token accounts
// or simulate transfer execution. Unsupported extension semantics stay explicit.
export function projectTokenMintControls(info,{slot,commitment='confirmed'}={}) {
 const key=x=>{if(x===null)return null;if(typeof x!=='string'||new PublicKey(x).toBase58()!==x)throw Error('authority');return x;};
 try {
  if(!info||info.isInitialized!==true||!/^\d+$/.test(info.supply)||BigInt(info.supply)>18446744073709551615n||!Number.isInteger(info.decimals)||info.decimals<0||info.decimals>255||!Number.isSafeInteger(slot)||slot<0||!['confirmed','finalized'].includes(commitment)||!Array.isArray(info.extensions))return null;
  const mintAuthority=key(info.mintAuthority),freezeAuthority=key(info.freezeAuthority),seen=new Set(),flags=[];
  if(mintAuthority)flags.push({id:'mint_authority_active',severity:'critical',detail:'Mint authority can issue additional supply.'});
  if(freezeAuthority)flags.push({id:'freeze_authority_active',severity:'critical',detail:'Freeze authority can freeze token accounts.'});
  for(const e of info.extensions){
   const type=e?.extension||e?.type;
   if(typeof type!=='string'||seen.has(type))return null;seen.add(type);
   if(['metadataPointer','tokenMetadata','transferFeeConfig'].includes(type))continue;
   const details={permanentDelegate:'A mint-level delegate may transfer or burn holder tokens.',transferHook:'Custom transfer logic may restrict transfers; execution is not verified.',nonTransferable:'The mint reports a non-transferable extension.',defaultAccountState:'New account default state requires verification.',pausableConfig:'Pause permissions and current pause state require verification.',mintCloseAuthority:'Mint close authority configuration requires verification.'};
   flags.push({id:type,severity:'critical',detail:details[type]||'Unsupported extension permissions; absence of privileged controls cannot be concluded.'});
  }
  return {schemaVersion:1,slot,commitment,supplyRaw:info.supply,decimals:info.decimals,mintAuthority,freezeAuthority,extensionTypes:[...seen],flags,
   additionalControlsResolved:[...seen].every(t=>['metadataPointer','tokenMetadata','transferFeeConfig'].includes(t)),
   scope:'Mint configuration at the RPC context slot. Account-specific restrictions, transfer execution and future changes are outside coverage.'};
 }catch{return null;}
}
