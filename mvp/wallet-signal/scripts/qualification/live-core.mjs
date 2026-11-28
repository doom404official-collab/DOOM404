/** Mint-only normal investigation core, isolated durable cold/warm snapshots.
 * No creator/signature input; reference matching must run AFTER capture.
 * This is NOT a hosted full-dashboard/score/browser qualification claim.
 */
import {createHash,randomUUID} from 'node:crypto';
import {investigateToken} from '../../lib/boundedTokenInvestigation.mjs';
import {scannerContext} from '../../lib/scannerRequestContext.mjs';
import {installScannerProviderGuard} from '../../lib/scannerProviderGuard.mjs';
const env=process.env,native=globalThis.fetch,sha=env.GITHUB_SHA,run=env.GITHUB_RUN_ID+'-'+env.GITHUB_RUN_ATTEMPT;
if(env.GITHUB_REPOSITORY!=='doom404official-collab/DOOM404'||!/^refs\/heads\/(qualification\/autonomous-engine-20261128|integration\/glitch-app-main-20261118)$/.test(env.GITHUB_REF||'')||!/^[a-f0-9]{40}$/.test(sha||'')||!/^\d+-\d+$/.test(run))throw Error('TRUSTED_QUALIFICATION_CONTEXT_REQUIRED');
const mints=JSON.parse(env.QUALIFICATION_MINTS||'[]');
if(!Array.isArray(mints)||!mints.length||mints.length>20||new Set(mints).size!==mints.length||mints.some(m=>!(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/).test(m)))throw Error('INVALID_MINT_LIST');
const endpoint=env.ALCHEMY_RPC_URL||env.ALCHEMY_SOLANA_ARCHIVE_RPC_URL||env.HELIUS_RPC_URL,secondary=env.HELIUS_RPC_URL!==endpoint?env.HELIUS_RPC_URL:null;
const root=env.SUPABASE_URL?.replace(/\/$/,'');
if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(root||'')||!env.SUPABASE_SERVICE_ROLE_KEY||!endpoint)throw Error('QUALIFICATION_CREDENTIALS_UNAVAILABLE');
for(const url of [endpoint,secondary].filter(Boolean))if(new URL(url).protocol!=='https:')throw Error('HTTPS_REQUIRED');
async function vault(path,body){const response=await native(root+'/rest/v1/'+path,{method:body===undefined?'GET':'POST',headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,'content-type':'application/json',Prefer:'return=minimal'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(4000)});if(!response.ok)throw Error('QUALIFICATION_VAULT_UNAVAILABLE');return response.status===204||response.headers.get('content-length')==='0'?null:response.json();}
const hash=x=>createHash('sha256').update(x).digest('hex');
installScannerProviderGuard();
for(const mint of mints){
 const key='scanner_qualification_observations?run_id=eq.'+run+'&candidate_sha=eq.'+sha+'&mint=eq.'+mint;
 const initial=await vault(key+'&select=phase');if(initial.length)throw Error('COLD_NAMESPACE_NOT_EMPTY');
 for(const phase of ['cold','warm']){
  const rows=phase==='warm'?await vault(key+'&phase=eq.cold&select=observation'):[];
  if(phase==='warm'&&rows.length!==1)throw Error('AUTOMATIC_COLD_PERSISTENCE_UNCONFIRMED');
  const lease=randomUUID(),admit=await vault('rpc/scanner_admit_v1',{p_client:hash('doom404-autonomous-qualification'),p_key:hash(run+sha+mint+phase),p_route:'token-investigation',p_id:lease});
  if(admit?.status!=='ADMITTED'){console.log(JSON.stringify({mint,phase,status:admit?.status||'ADMISSION_FAILED',candidateSha:sha}));break;}
  const controller=new AbortController(),ctx={lease,controller,closed:false,store:{debit:args=>vault('rpc/scanner_debit_v1',args)}};
  const timer=setTimeout(()=>controller.abort(),34000),start=performance.now();let calls=0;
  try{
   const observation=await scannerContext.run(ctx,()=>investigateToken({mint,previousObservation:rows[0]?.observation,providerName:new URL(endpoint).hostname.includes('alchemy')?'alchemy':'helius',alternateProviderName:secondary?'helius':null,rpc:async(method,params,{provider}={})=>{
    controller.signal.throwIfAborted();if(++calls>18)throw Error('BOUNDED_REQUEST_LIMIT');
    const response=await fetch(provider==='secondary'&&secondary?secondary:endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:calls,method,params}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(3500)])});
    if(!response.ok)throw Error('PROVIDER_TEMPORARILY_UNAVAILABLE');const reader=response.body.getReader(),chunks=[];let length=0;try{while(true){const r=await reader.read();if(r.done)break;length+=r.value.byteLength;if(length>2000000){await reader.cancel();throw Error('BOUNDED_RESPONSE_LIMIT');}chunks.push(r.value);}}finally{reader.releaseLock();}const data=JSON.parse(Buffer.concat(chunks).toString());if(data.error){const error=Error('RPC_METHOD_ERROR');error.code=data.error.code;throw error;}return data.result;
   }}));
   const metrics={durationMs:Math.round(performance.now()-start),providerAttempts:ctx.attempts,requests:calls,scope:'normal_investigation_core_not_full_report',manualIntelligenceInputs:0};
   await vault('scanner_qualification_observations',{run_id:run,candidate_sha:sha,mint,phase,observation,metrics});
   // Only sanitized aggregate status is public. No Vault receipts or raw cache.
   console.log(JSON.stringify({candidateSha:sha,run,mint,phase,metrics,creatorEstablished:!!observation.creator?.attribution?.verified,eventCount:observation.creator?.events?.length||0,rewards:observation.creator?.events?.filter(e=>e.acquisitionMechanism==='protocol_holder_reward_distribution').length||0,failures:observation.execution?.failures,stopReason:observation.execution?.stopReason,persisted:true}));
  }catch(error){console.log(JSON.stringify({candidateSha:sha,run,mint,phase,status:'failed',code:/^[A-Z_]+$/.test(error.code||error.message)?error.code||error.message:'EXECUTION_FAILED'}));process.exitCode=1;break;}
  finally{clearTimeout(timer);ctx.closed=true;controller.abort();await vault('rpc/scanner_finish_v1',{p_id:lease,p_body:null,p_status:200});}
 }
}
