// Server-only Supabase Storage transport. No credentials are read or logged here.
export function createCreatorEvidenceTransport({projectUrl,serviceKey,fetchImpl=fetch}={}){
 if(typeof projectUrl!=='string'||!/^https:\/\/acwmtobcbpkjfqiatyke\.supabase\.co\/?$/.test(projectUrl)||
    typeof serviceKey!=='string'||!serviceKey)throw Error('PRIVATE_STORAGE_CONFIGURATION_REQUIRED');
 const base=projectUrl.replace(/\/$/,'')+'/storage/v1/object/creator-historical-evidence/';
 const headers={apikey:serviceKey,authorization:'Bearer '+serviceKey};
 const target=key=>{
  if(typeof key!=='string'||key!=='global/442809233/4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf/9aa57beb2b897cc175a536f170ddb25c0c8bed8ed6620c7087d8a7fb834f7d30.json'||key.includes('..'))throw Error('INVALID_EVIDENCE_KEY');
  return base+key;
 };
 return {
  upload:async(key,bytes,{overwrite=false}={})=>{
   if(overwrite!==false||!Buffer.isBuffer(bytes)||bytes.length>1048576)throw Error('UNSAFE_EVIDENCE_UPLOAD');
   const response=await fetchImpl(target(key),{method:'POST',headers:{...headers,'content-type':'application/json','x-upsert':'false'},body:bytes,signal:AbortSignal.timeout(20000)});
   return response.ok;
  },
  read:async(key)=>{
   const response=await fetchImpl(target(key),{method:'GET',headers,signal:AbortSignal.timeout(20000)});
   return response.ok?Buffer.from(await response.arrayBuffer()):null;
  }
 };
}
