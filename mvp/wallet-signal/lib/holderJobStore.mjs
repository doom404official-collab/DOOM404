import {publicHolderScanView} from "./publicHolderScanView.mjs";
const table="glitch_holder_scan_jobs";
export function createHolderJobStore({url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY,fetchImpl=fetch}={}){
 if(!url||!key||!/^https:\/\//.test(url))throw Error("HOLDER_STORE_NOT_CONFIGURED");
 const base=url.replace(/\/$/,"")+"/rest/v1/";
 const headers={apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json"};
 async function request(path,{method="GET",body,prefer,signal}={}){
  const response=await fetchImpl(base+path,{method,headers:{...headers,...(prefer?{Prefer:prefer}:{})},
   ...(body===undefined?{}:{body:JSON.stringify(body)}),cache:"no-store",...(signal?{signal}:{})});
  if(!response.ok)throw Error("HOLDER_STORE_HTTP_"+response.status);
  return response.status===204?null:response.json();
 }
 async function rpc(name,args,options={}){
  const response=await request("rpc/"+name,{method:"POST",body:args,...options});
  if(response===null||response?.id===null)return null;
  if(!response||typeof response!=="object"||Array.isArray(response)||typeof response.id!=="string"||!response.id)throw Error("INVALID_HOLDER_RPC_RESPONSE");
  return response;
 }
 return {
  async getById(jobId,options={}){
   if(typeof jobId!=="string"||!jobId.trim())throw Error("INVALID_HOLDER_JOB_ID");
   const rows=await request(table+"?id=eq."+encodeURIComponent(jobId)+"&select=id,mint,status,checkpoint,summary,updated_at,version,lease_owner,lease_expires_at&limit=1",options);
   if(!Array.isArray(rows)||rows.length>1||(rows.length===1&&(!rows[0]||typeof rows[0]!=="object"||Array.isArray(rows[0]))))throw Error("INVALID_HOLDER_JOB_RESPONSE");
   return rows[0]||null;
  },
  async getLatest(mint){
   const rows=await request(table+"?mint=eq."+encodeURIComponent(mint)+"&select=id,mint,status,checkpoint,summary,updated_at,version&order=updated_at.desc&limit=1");
   return rows?.[0]||null;
  },
  async createOrReuse({mint,holderSetHash,checkpoint}){
   const rows=await request(table+"?on_conflict=mint,holder_set_hash",{method:"POST",
    prefer:"resolution=ignore-duplicates,return=representation",
    body:[{mint,holder_set_hash:holderSetHash,checkpoint,status:"queued"}]});
   if(rows?.[0])return rows[0];
   const existing=await request(table+"?mint=eq."+encodeURIComponent(mint)+"&holder_set_hash=eq."+encodeURIComponent(holderSetHash)+"&select=id,mint,status,version&limit=1");
   if(!existing?.[0])throw Error("HOLDER_JOB_NOT_FOUND_AFTER_CONFLICT");
   return existing[0];
  },
  async getNextRunnable(options={}){
   const now=new Date().toISOString();
   const filter="or=(lease_owner.is.null,lease_expires_at.lte."+encodeURIComponent(now)+")";
   const rows=await request(table+"?select=id,mint,status,updated_at,lease_owner,lease_expires_at&status=in.(queued,partial,running)&"+filter+"&order=updated_at.asc&limit=1",options);
   // Database filters active leases; atomic claim still resolves concurrent races.
   return rows?.[0]||null;
  },
  claim:(jobId,workerId,seconds=90,options={})=>rpc("glitch_claim_holder_scan",{p_job_id:jobId,p_worker:workerId,p_lease_seconds:seconds},options),
  renew:(jobId,workerId,version,seconds=90,options={})=>rpc("glitch_renew_holder_scan",{p_job_id:jobId,p_worker:workerId,p_expected_version:version,p_lease_seconds:seconds},options),
  commit:(jobId,workerId,version,checkpoint,summary,status,options={})=>rpc("glitch_commit_holder_scan",{
   p_job_id:jobId,p_worker:workerId,p_expected_version:version,p_checkpoint:checkpoint,p_summary:summary,p_status:status},options),
  publicView:(row)=>row?.checkpoint?{...publicHolderScanView(row.checkpoint,{updatedAt:row.updated_at}),scanStatus:row.status}:null
 };
}
