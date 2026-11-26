import {normalizeMintAuthority} from './mintAuthorityEvidence.mjs';
// Public projection of validated mint configuration. No provider URLs or raw state.
export function projectSecurityConfiguration(info,{slot,commitment='confirmed'}={}){
 try{
  if(!info||info.isInitialized!==true||!Array.isArray(info.extensions)||!Number.isSafeInteger(slot)||!['confirmed','finalized'].includes(commitment))return null;
  const mintAuthority=normalizeMintAuthority(info.mintAuthority),freezeAuthority=normalizeMintAuthority(info.freezeAuthority);
  if(mintAuthority===undefined||freezeAuthority===undefined)return null;
  const permissions={},unknown=[],seen=new Set();
  for(const e of info.extensions){
   const t=e.extension||e.type,s=e.state;
   if(typeof t!=='string'||seen.has(t))return null;seen.add(t);
   const authority=(k)=>{const v=normalizeMintAuthority(s?.[k]);if(v===undefined)throw Error();return v;};
   if(t==='permanentDelegate')permissions.delegate=authority('delegate');
   else if(t==='transferHook')permissions.hook={authority:authority('authority'),programId:authority('programId')};
   else if(t==='pausableConfig'){if(typeof s?.paused!=='boolean')throw Error();permissions.pause={authority:authority('authority'),paused:s.paused};}
   else if(t==='defaultAccountState'){const v=s?.state;if(!['initialized','frozen',1,2].includes(v))throw Error();permissions.defaultFrozen=v==='frozen'||v===2;}
   else if(t==='nonTransferable')permissions.nonTransferable=true;
   else if(t==='confidentialTransferMint'){permissions.confidentialAuthority=authority('authority');if(typeof s?.autoApproveNewAccounts!=='boolean')throw Error();}
   else if(t==='confidentialTransferFeeConfig'){permissions.confidentialFeeAuthority=authority('authority');if(typeof s?.harvestToMintEnabled!=='boolean')throw Error();}
   else if(t==='mintCloseAuthority')permissions.closeAuthority=authority('closeAuthority');
   else if(!['transferFeeConfig','metadataPointer','tokenMetadata'].includes(t))unknown.push(t);
  }
  return {version:2,slot,commitment,mintAuthority,freezeAuthority,permissions,unknownExtensions:unknown,extensionTypes:[...seen],scope:'Mint-level controls; account-specific freezes and actual transfer execution are separate evidence.'};
 }catch{return null;}
}

export function validSecurityConfiguration(c){
 try{
  if(c?.version!==2||!Number.isSafeInteger(c.slot)||c.slot<0||!['confirmed','finalized'].includes(c.commitment)||normalizeMintAuthority(c.mintAuthority)===undefined||normalizeMintAuthority(c.freezeAuthority)===undefined||!Array.isArray(c.extensionTypes)||new Set(c.extensionTypes).size!==c.extensionTypes.length||c.extensionTypes.length>128||c.extensionTypes.some(t=>typeof t!=='string'||!t.length)||!Array.isArray(c.unknownExtensions)||!c.permissions||typeof c.permissions!=='object'||Array.isArray(c.permissions))return false;
  const p=c.permissions,key=k=>Object.hasOwn(p,k)&&normalizeMintAuthority(p[k])!==undefined;
  for(const t of c.extensionTypes){
   if(t==='permanentDelegate'&&!key('delegate'))return false;
   if(t==='mintCloseAuthority'&&!key('closeAuthority'))return false;
   if(t==='transferHook'&&(!p.hook||normalizeMintAuthority(p.hook.authority)===undefined||normalizeMintAuthority(p.hook.programId)===undefined))return false;
   if(t==='pausableConfig'&&(!p.pause||normalizeMintAuthority(p.pause.authority)===undefined||typeof p.pause.paused!=='boolean'))return false;
   if(t==='nonTransferable'&&p.nonTransferable!==true)return false;
   if(t==='defaultAccountState'&&typeof p.defaultFrozen!=='boolean')return false;
   if(t==='confidentialTransferMint'&&!key('confidentialAuthority'))return false;
   if(t==='confidentialTransferFeeConfig'&&!key('confidentialFeeAuthority'))return false;
  }
  const known=['permanentDelegate','mintCloseAuthority','transferHook','pausableConfig','nonTransferable','defaultAccountState','confidentialTransferMint','confidentialTransferFeeConfig','transferFeeConfig','metadataPointer','tokenMetadata'];
  return JSON.stringify(c.extensionTypes.filter(t=>!known.includes(t)))===JSON.stringify(c.unknownExtensions);
 }catch{return false;}
}
