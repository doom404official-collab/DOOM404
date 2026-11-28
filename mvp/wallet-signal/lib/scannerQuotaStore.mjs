import {traceSpan} from './scannerTrace.mjs';
import {ScannerDenied} from './scannerRequestContext.mjs';
// Bypass provider instrumentation for the quota store itself, never for a provider.
export function createScannerQuotaStore({env=process.env,fetchImpl,timeoutMs=2500}={}){
 const endpoint=env.SUPABASE_URL?.replace(/\/$/,''),secret=env.SUPABASE_SERVICE_ROLE_KEY;
 const native=fetchImpl||globalThis[Symbol.for('doom404.scanner.provider-usage.v2')]?.original||globalThis.fetch;
 async function rpc(name,args){return traceSpan(name==='scanner_debit_v1'?'quota_debit':name==='scanner_finish_v1'?'quota_finish':'quota_admit',async()=>{
  if(!secret||!endpoint||!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(endpoint))throw new ScannerDenied('QUOTA_STORE_UNAVAILABLE');
  try{
   const response=await native(endpoint+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(timeoutMs),cache:'no-store'});
   if(!response.ok)throw Error('STORE_HTTP');
   const data=await response.json();
   if(name==='scanner_finish_v1'&&typeof data==='boolean')return data;
   if(!data||typeof data!=='object')throw Error('STORE_SHAPE');
   return data;
  }catch{throw new ScannerDenied('QUOTA_STORE_UNAVAILABLE');}
 });}
 return {admit:args=>rpc('scanner_admit_v2',args),debit:args=>rpc('scanner_debit_v1',args),finish:args=>rpc('scanner_finish_v1',args)};
}
