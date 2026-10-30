import {createCreatorExecutionBudget,assertCreatorSignal} from './creatorExecutionBudget.mjs';
/** Server-only durable creator intelligence job store. Service-role credentials required. */
const address=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const stages=new Set(['identification','holdings','selling','previous_launches','complete']);
const statuses=new Set(['queued','running','partial','complete','failed']);
export function createCreatorIntelligenceJobStore({url,key,fetchImpl=fetch}={}){
 if(!/^https:\/\/[^/]+\.supabase\.co\/?$/.test(url||'')||!key)throw Error('CREATOR_STORE_CONFIGURATION');
 const base=url.replace(/\/$/,'')+'/rest/v1/';
 const headers={apikey:key,authorization:'Bearer '+key,'content-type':'application/json'};
 async function request(path,{method='GET',body,prefer,signal}={}){
  const write=method!=='GET',label=path.includes('claim_')?'CLAIM':path.includes('save_')?'SAVE':'ENQUEUE';
  let dispatched=false;
  try{return await createCreatorExecutionBudget().run('STORE',async innerSignal=>{
   const serialized=body===undefined?undefined:JSON.stringify(body);
   assertCreatorSignal(signal);assertCreatorSignal(innerSignal);
   dispatched=true;
   const response=await fetchImpl(base+path,{method,headers:{...headers,...(prefer?{prefer}:{})},cache:'no-store',...(serialized===undefined?{}:{body:serialized}),signal:innerSignal});
   assertCreatorSignal(signal);assertCreatorSignal(innerSignal);
   if(!response.ok)throw Error('CREATOR_STORE_HTTP_'+response.status);
   if(method==='GET'||path.startsWith('rpc/')||prefer==='return=representation')return response.json();
   return true;
  },{signal});}catch(error){
   if(write&&dispatched)throw Error('CREATOR_'+label+'_OUTCOME_UNKNOWN');
   if(write)throw Error('CREATOR_STORE_REQUEST_NOT_SENT');
   throw Error(/^CREATOR_STORE_HTTP_[0-9]{3}$/.test(error?.message||'')?error.message:'CREATOR_STORE_READ_FAILED');
  }
 }
 function checkMint(mint){if(!address.test(mint||''))throw Error('INVALID_MINT')}
 return {
  async get(mint,{signal}={}){checkMint(mint);const rows=await request('creator_intelligence_jobs?mint=eq.'+mint+'&select=*',{signal});
   if(!Array.isArray(rows)||rows.length>1)throw Error('CREATOR_STORE_INVALID_RESPONSE');
   const row=rows[0];if(!row)return null;
   if(row.mint!==mint||!stages.has(row.stage)||!statuses.has(row.status)||!row.state||typeof row.state!=='object'||Array.isArray(row.state)||
    !Object.hasOwn(row,'lease_owner')||(row.lease_owner!==null&&(typeof row.lease_owner!=='string'||row.lease_owner.length<8)))throw Error('CREATOR_STORE_INVALID_ROW');
   return row},
  async enqueue(mint){checkMint(mint);await request('creator_intelligence_jobs?on_conflict=mint',{method:'POST',prefer:'resolution=ignore-duplicates,return=minimal',body:{mint,status:'queued',stage:'identification'}});return this.get(mint)},
  async claim(mint,owner,seconds=180,{signal}={}){checkMint(mint);if(typeof owner!=='string'||owner.length<8)throw Error('INVALID_OWNER');
   if(!Number.isSafeInteger(seconds)||seconds<1||seconds>180)throw Error('INVALID_CREATOR_LEASE');
   const result=await request('rpc/claim_creator_intelligence_job',{method:'POST',signal,body:{p_mint:mint,p_owner:owner,p_lease_seconds:seconds}});
   if(typeof result!=='boolean')throw Error('CREATOR_CLAIM_OUTCOME_UNKNOWN');return result},
  async save({mint,owner,stage,status='partial',state,requestCount=0},{signal}={}){
   checkMint(mint);
   if(!stages.has(stage)||!statuses.has(status)||typeof owner!=='string'||owner.length<8||!Number.isInteger(requestCount)||requestCount<0||requestCount>500||!state||typeof state!=='object'||Array.isArray(state))throw Error('INVALID_JOB_UPDATE');
   const result=await request('rpc/save_creator_intelligence_progress',{method:'POST',signal,body:{
    p_mint:mint,p_owner:owner,p_stage:stage,p_status:status,p_state:state,p_request_delta:requestCount
   }});
   if(result===false)throw Error('CREATOR_LEASE_LOST');
   if(result!==true)throw Error('CREATOR_SAVE_OUTCOME_UNKNOWN');
   return true;
  }
 };
}
