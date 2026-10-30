import {isDeepStrictEqual} from 'node:util';
import {createCreatorExecutionBudget,assertCreatorSignal} from './creatorExecutionBudget.mjs';
// Preparation only. No environment flag, runner, route, enqueue or legacy fallback.
// Explicit enablement is reserved for tests and a separately approved integration.
const address=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const stages=new Set(['identification','holdings','selling','previous_launches','complete']);
const statuses=new Set(['queued','running','partial','complete','failed']);
const maxRevision=9223372036854775807n;
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
function decimal(value,{increment=false}={}){
 if(typeof value!=='string'||!/^(0|[1-9][0-9]*)$/.test(value)||value.length>19||BigInt(value)>maxRevision||(increment&&BigInt(value)===maxRevision))throw Error('CREATOR_V2_INVALID_REVISION');
 return value;
}
function timestamp(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value))throw Error('CREATOR_V2_INVALID_EXPIRY');
 const [year,month,day]=value.slice(0,10).split('-').map(Number);
 const [hour,minute,second]=value.slice(11,19).split(':').map(Number);
 const time=Date.parse(value);
 if(hour>23||minute>59||second>59||month<1||month>12||day<1||day>new Date(Date.UTC(year,month,0)).getUTCDate()||!Number.isFinite(time))throw Error('CREATOR_V2_INVALID_EXPIRY');
 return time;
}
function identity(mint,owner){
 if(typeof mint!=='string'||!address.test(mint)||typeof owner!=='string'||owner.length<8)throw Error('CREATOR_V2_INVALID_IDENTITY');
}
export function createCreatorIntelligenceJobStoreV2({enabled=false,url,key,fetchImpl=fetch,now=Date.now}={}){
 if(enabled!==true)throw Error('CREATOR_V2_DISABLED');
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url||'')||typeof key!=='string'||!key||typeof fetchImpl!=='function'||typeof now!=='function')throw Error('CREATOR_V2_CONFIGURATION');
 const base=url.replace(/\/$/,'')+'/rest/v1/',reads=new Map(),leases=new Map();let blocked=false,inFlight=false;
 const stop=()=>{if(blocked)throw Error('CREATOR_V2_RECONCILIATION_REQUIRED');};
 async function write(operation){stop();if(inFlight)throw Error('CREATOR_V2_WRITE_IN_FLIGHT');inFlight=true;try{return await operation();}finally{inFlight=false;}}
 function active(until){const wall=now();if(!Number.isSafeInteger(wall))throw Error('CREATOR_V2_INVALID_CLOCK');const remaining=timestamp(until)-wall;if(remaining<=0||remaining>180000)throw Error('CREATOR_V2_LEASE_INVALID');return Math.floor(remaining);}
 async function request(path,{body,signal,leaseUntil}={}){
  const write=body!==undefined;let dispatched=false;
  const duration=leaseUntil?Math.min(15000,active(leaseUntil)):15000;
  try{return await createCreatorExecutionBudget({maxDurationMs:duration}).run('V2_STORE',async inner=>{
   const serialized=write?JSON.stringify(body):undefined;
   assertCreatorSignal(signal);assertCreatorSignal(inner);if(leaseUntil)active(leaseUntil);
   dispatched=true;
   const response=await fetchImpl(base+path,{method:write?'POST':'GET',headers:{apikey:key,authorization:'Bearer '+key,'content-type':'application/json'},cache:'no-store',signal:inner,...(write?{body:serialized}:{})});
   assertCreatorSignal(signal);assertCreatorSignal(inner);if(leaseUntil)active(leaseUntil);
   if(!response.ok)throw Error('CREATOR_V2_TRANSPORT_FAILED');
   const data=await response.json();
   assertCreatorSignal(signal);assertCreatorSignal(inner);if(leaseUntil)active(leaseUntil);
   return data;
  },{signal});}catch{
   if(write&&dispatched){blocked=true;throw Error('CREATOR_V2_WRITE_OUTCOME_UNKNOWN');}
   throw Error(write?'CREATOR_V2_REQUEST_NOT_SENT':'CREATOR_V2_READ_FAILED');
  }
 }
 async function readRow(mint,signal){
  if(typeof mint!=='string'||!address.test(mint))throw Error('CREATOR_V2_INVALID_IDENTITY');
  const select='mint,status,stage,state,request_count_total::text,lease_owner,lease_until,created_at,updated_at,revision::text';
  const rows=await request('creator_intelligence_jobs?mint=eq.'+mint+'&select='+encodeURIComponent(select)+'&limit=2',{signal});
  if(!Array.isArray(rows)||rows.length>1)throw Error('CREATOR_V2_INVALID_ROW');
  if(!rows.length)return null;
  const row=rows[0];
  if(!object(row)||row.mint!==mint||!statuses.has(row.status)||!stages.has(row.stage)||!object(row.state)||
   !Object.hasOwn(row,'lease_owner')||!Object.hasOwn(row,'lease_until')||(row.lease_owner===null)!==(row.lease_until===null)||
   (row.lease_owner!==null&&(typeof row.lease_owner!=='string'||row.lease_owner.length<8)))throw Error('CREATOR_V2_INVALID_ROW');
  decimal(row.revision);decimal(row.request_count_total);timestamp(row.created_at);timestamp(row.updated_at);
  if(row.lease_until!==null)timestamp(row.lease_until);
  return structuredClone(row);
 }
 function receipt(data,{mint,owner,expectedRevision,status,leaseUntil,leaseSeconds}){
  if(data===null){blocked=true;throw Error('CREATOR_V2_CONFLICT');}
  try{
   if(!object(data)||Object.keys(data).sort().join(',')!=='leaseUntil,mint,owner,revision,status'||data.mint!==mint||data.status!==status||
    data.owner!==(status==='running'?owner:null)||decimal(data.revision)!==(BigInt(expectedRevision)+1n).toString())throw Error();
   if(status==='running'){
    const remaining=active(data.leaseUntil);
    if(leaseUntil!==undefined&&data.leaseUntil!==leaseUntil)throw Error();
    if(leaseSeconds!==undefined&&remaining>leaseSeconds*1000)throw Error();
   }else if(data.leaseUntil!==null)throw Error();
   return Object.freeze({...data});
  }catch{blocked=true;throw Error('CREATOR_V2_WRITE_OUTCOME_UNKNOWN');}
 }
 return Object.freeze({
  get reconciliationRequired(){return blocked;},
  async read(mint,{signal}={}){const row=await readRow(mint,signal);assertCreatorSignal(signal);if(row)reads.set(mint,structuredClone(row));else reads.delete(mint);return row;},
  async claim({mint,owner,expectedRevision,leaseSeconds=180},{signal}={}){return write(async()=>{
   stop();identity(mint,owner);decimal(expectedRevision,{increment:true});
   if(!Number.isSafeInteger(leaseSeconds)||leaseSeconds<30||leaseSeconds>180)throw Error('CREATOR_V2_INVALID_LEASE');
   const prior=reads.get(mint);
   if(!prior||prior.revision!==expectedRevision)throw Error('CREATOR_V2_READ_REQUIRED');
   const data=await request('rpc/claim_creator_intelligence_job_v2',{signal,body:{p_mint:mint,p_owner:owner,p_expected_revision:expectedRevision,p_lease_seconds:leaseSeconds}});
   const proof=receipt(data,{mint,owner,expectedRevision,status:'running',leaseSeconds});
   try{
    const job=await readRow(mint,signal);assertCreatorSignal(signal);active(proof.leaseUntil);
    if(!job||job.revision!==proof.revision||job.lease_owner!==owner||job.lease_until!==proof.leaseUntil||job.status!=='running'||job.stage!==prior.stage||
     job.created_at!==prior.created_at||job.request_count_total!==prior.request_count_total||!isDeepStrictEqual(job.state,prior.state))throw Error();
    assertCreatorSignal(signal);active(proof.leaseUntil);
    leases.set(mint,proof);return {receipt:proof,job};
   }catch{blocked=true;throw Error('CREATOR_V2_CLAIM_RECONCILIATION_REQUIRED');}
  });},
  async save({mint,owner,expectedRevision,leaseUntil,stage,status='partial',state,requestCount=0},{signal}={}){return write(async()=>{
   stop();identity(mint,owner);decimal(expectedRevision,{increment:true});
   if(!stages.has(stage)||!['running','partial','complete','failed'].includes(status)||!object(state)||!Number.isSafeInteger(requestCount)||requestCount<0||requestCount>500)throw Error('CREATOR_V2_INVALID_SAVE');
   const prior=leases.get(mint);
   if(!prior||prior.owner!==owner||prior.revision!==expectedRevision||prior.leaseUntil!==leaseUntil)throw Error('CREATOR_V2_CLAIM_REQUIRED');
   active(leaseUntil);
   const data=await request('rpc/save_creator_intelligence_progress_v2',{signal,leaseUntil,body:{p_mint:mint,p_owner:owner,p_expected_revision:expectedRevision,p_stage:stage,p_status:status,p_state:state,p_request_delta:requestCount}});
   const proof=receipt(data,{mint,owner,expectedRevision,status,leaseUntil});
   if(status==='running')leases.set(mint,proof);else leases.delete(mint);
   reads.delete(mint);return proof;
  });}
 });
}
