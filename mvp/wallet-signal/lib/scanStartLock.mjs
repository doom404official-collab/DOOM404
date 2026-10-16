import {randomUUID} from 'node:crypto';
// Server-only atomic per-mint lock for expensive snapshot preparation.
export function createScanStartLock({url,key,fetchImpl=fetch}={}){
 if(!url?.startsWith('https://')||!key)throw Error('SCAN_LOCK_NOT_CONFIGURED');
 const base=new URL(url);
 if(base.pathname!=='/'||base.search||base.hash)throw Error('SCAN_LOCK_INVALID_ORIGIN');
 async function rpc(name,payload){
  const response=await fetchImpl(base.origin+'/rest/v1/rpc/'+name,{
   method:'POST',cache:'no-store',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},
   body:JSON.stringify(payload)});
  if(!response.ok)throw Error('SCAN_LOCK_UNAVAILABLE');
  return response.status===204?null:response.json();
 }
 return {
  async acquire(mint){
   const owner=randomUUID();
   const granted=await rpc('glitch_claim_scan_start',{p_mint:mint,p_owner:owner,p_seconds:90});
   return granted===true?{mint,owner}:null;
  },
  async release(lock){
   if(!lock?.mint||!lock?.owner)throw Error('INVALID_SCAN_LOCK');
   await rpc('glitch_release_scan_start',{p_mint:lock.mint,p_owner:lock.owner});
  }
 };
}
