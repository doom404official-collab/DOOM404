import {createHash} from 'node:crypto';
// Server-only durable quota adapter. Caller must authenticate identity first.
// Never store raw account identifiers, emails or IP addresses.
export function createDeepScanQuota({url,serviceRoleKey,fetchImpl=fetch,pepper}={}){
 if(!/^https:\/\//.test(url??'')||!serviceRoleKey||!pepper||pepper.length<32)
  throw new TypeError('Quota configuration missing');
 const parsed=new URL(url);
 if(parsed.pathname!=='/'||parsed.search||parsed.hash)throw new TypeError('Invalid Supabase origin');
 return {
  async admit({requesterId,mint}={}){
   if(typeof requesterId!=='string'||!requesterId||!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint??''))
    throw new TypeError('Invalid quota request');
   const requesterHash=createHash('sha256').update(pepper+'|'+requesterId).digest('hex');
   const response=await fetchImpl(parsed.origin+'/rest/v1/rpc/glitch_admit_deep_scan',{
    method:'POST',headers:{apikey:serviceRoleKey,Authorization:'Bearer '+serviceRoleKey,'Content-Type':'application/json'},
    body:JSON.stringify({p_requester_hash:requesterHash,p_mint:mint,p_per_requester_limit:5,p_per_mint_limit:2}),
    cache:'no-store'
   });
   if(!response.ok)throw new Error('DEEP_SCAN_QUOTA_HTTP_'+response.status);
   const allowed=await response.json();
   if(typeof allowed!=='boolean')throw new Error('Invalid quota response');
   return allowed;
  }
 };
}
