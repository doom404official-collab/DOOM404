/** Server-only Supabase REST persistence for transaction evidence checks. */
export function createHolderEvidenceStore({url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY,fetchImpl=fetch}={}){
 if(!url||!key||!/^https:\/\//.test(url))throw Error("EVIDENCE_STORE_NOT_CONFIGURED");
 const root=url.replace(/\/$/,"")+"/rest/v1/";
 const base=root+"glitch_holder_evidence_validation";
 const headers={apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json"};
 async function request(path,{method="GET",body,prefer}={}){
  const response=await fetchImpl(base+path,{method,headers:{...headers,...(prefer?{Prefer:prefer}:{})},
   ...(body===undefined?{}:{body:JSON.stringify(body)}),cache:"no-store"});
  if(!response.ok)throw Error("EVIDENCE_STORE_HTTP_"+response.status);
  return response.status===204?[]:response.json();
 }
 async function callRpc(name,args){
  const response=await fetchImpl(root+"rpc/"+name,{method:"POST",headers,body:JSON.stringify(args),cache:"no-store"});
  if(!response.ok)throw Error("EVIDENCE_RPC_HTTP_"+response.status);
  return response.json();
 }
 return {
  async listForJob(jobId,{pageSize=500}={}){
   if(!Number.isInteger(pageSize)||pageSize<1||pageSize>1000)throw Error("INVALID_PAGE_SIZE");
   const all=[];
   for(let offset=0;offset<100000;offset+=pageSize){
    const rows=await request("?job_id=eq."+encodeURIComponent(jobId)+
     "&select=signature,status,evidence,attempts&order=signature.asc&limit="+pageSize+"&offset="+offset);
    if(!Array.isArray(rows))throw Error("INVALID_EVIDENCE_ROWS");
    all.push(...rows);
    if(rows.length<pageSize)return all;
   }
   throw Error("EVIDENCE_PAGINATION_LIMIT");
  },
  seed:(jobId)=>callRpc("glitch_seed_holder_evidence",{p_job_id:jobId}),
  claim:(jobId,workerId,limit=6)=>callRpc("glitch_claim_holder_evidence",{p_job_id:jobId,p_worker:workerId,p_limit:limit}),
  finish:(jobId,signature,workerId,{status,evidence,attempts})=>callRpc("glitch_finish_holder_evidence",{p_job_id:jobId,p_signature:signature,p_worker:workerId,p_status:status,p_evidence:evidence,p_attempts:attempts}),
  async enqueue(jobId,signatures){
   const rows=[...new Set(signatures)].filter(x=>typeof x==="string"&&x.length>0)
    .map(signature=>({job_id:jobId,signature}));
   if(!rows.length)return [];
   return request("?on_conflict=job_id,signature",{method:"POST",prefer:"resolution=ignore-duplicates,return=minimal",body:rows});
  },
  async pending(jobId,limit=6){
   if(!Number.isInteger(limit)||limit<1||limit>50)throw Error("INVALID_LIMIT");
   return request("?job_id=eq."+encodeURIComponent(jobId)+"&status=in.(pending,unavailable)&attempts=lt.5&select=signature,attempts,status&order=attempts.asc,signature.asc&limit="+limit);
  },
  async save(jobId,signature,{status,evidence={},attempts}){
   if(!["verified","rejected","unavailable"].includes(status)||!Number.isInteger(attempts)||attempts<1)throw Error("INVALID_EVIDENCE_RESULT");
   return request("?job_id=eq."+encodeURIComponent(jobId)+"&signature=eq."+encodeURIComponent(signature),
    {method:"PATCH",prefer:"return=minimal",body:{status,evidence,attempts,checked_at:new Date().toISOString()}});
  }
 };
}
