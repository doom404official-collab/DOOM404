/** Server-only durable creator intelligence job store. Service-role credentials required. */
const address=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const stages=new Set(['identification','holdings','selling','previous_launches','complete']);
const statuses=new Set(['queued','running','partial','complete','failed']);
export function createCreatorIntelligenceJobStore({url,key,fetchImpl=fetch}={}){
 if(!/^https:\/\/[^/]+\.supabase\.co\/?$/.test(url||'')||!key)throw Error('CREATOR_STORE_CONFIGURATION');
 const base=url.replace(/\/$/,'')+'/rest/v1/';
 const headers={apikey:key,authorization:'Bearer '+key,'content-type':'application/json'};
 async function request(path,{method='GET',body,prefer}={}){
  const response=await fetchImpl(base+path,{method,headers:{...headers,...(prefer?{prefer}:{})},cache:'no-store',...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('CREATOR_STORE_HTTP_'+response.status);
  if(method==='GET'||path.startsWith('rpc/')||prefer==='return=representation')return response.json();
  return true;
 }
 function checkMint(mint){if(!address.test(mint||''))throw Error('INVALID_MINT')}
 return {
  async get(mint){checkMint(mint);const rows=await request('creator_intelligence_jobs?mint=eq.'+mint+'&select=*');return rows[0]||null},
  async enqueue(mint){checkMint(mint);await request('creator_intelligence_jobs?on_conflict=mint',{method:'POST',prefer:'resolution=ignore-duplicates,return=minimal',body:{mint,status:'queued',stage:'identification'}});return this.get(mint)},
  async claim(mint,owner,seconds=180){checkMint(mint);if(typeof owner!=='string'||owner.length<8)throw Error('INVALID_OWNER');return request('rpc/claim_creator_intelligence_job',{method:'POST',body:{p_mint:mint,p_owner:owner,p_lease_seconds:seconds}})},
  async save({mint,owner,stage,status='partial',state,requestCount=0}){
   checkMint(mint);
   if(!stages.has(stage)||!statuses.has(status)||typeof owner!=='string'||owner.length<8||!Number.isInteger(requestCount)||requestCount<0||requestCount>500||!state||typeof state!=='object'||Array.isArray(state))throw Error('INVALID_JOB_UPDATE');
   const result=await request('rpc/save_creator_intelligence_progress',{method:'POST',body:{
    p_mint:mint,p_owner:owner,p_stage:stage,p_status:status,p_state:state,p_request_delta:requestCount
   }});
   if(result!==true)throw Error('CREATOR_LEASE_LOST');
   return true;
  }
 };
}
