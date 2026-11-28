// Post-scan collection only. No inference or reference data enters normal scans.
import {createHash,randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {scannerContext} from '../../mvp/wallet-signal/lib/scannerRequestContext.mjs';
import {installScannerProviderGuard} from '../../mvp/wallet-signal/lib/scannerProviderGuard.mjs';
const e=process.env,native=fetch,run=e.REFERENCE_RUN_ID,sha=e.REFERENCE_CANDIDATE_SHA;
if(e.GITHUB_REPOSITORY!=='doom404official-collab/DOOM404'||e.GITHUB_REF!=='refs/heads/qualification/autonomous-engine-20261128'||!/^\d+-\d+$/.test(run||'')||!/^[a-f0-9]{40}$/.test(sha||''))throw Error('TRUSTED_POST_SCAN_CONTEXT_REQUIRED');
const root=e.SUPABASE_URL?.replace(/\/$/,''),endpoint=e.HELIUS_RPC_URL;
if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(root||'')||!e.SUPABASE_SERVICE_ROLE_KEY||!endpoint||new URL(endpoint).protocol!=='https:')throw Error('REFERENCE_CREDENTIALS_UNAVAILABLE');
async function vault(path,body){const r=await native(root+'/rest/v1/'+path,{method:body===undefined?'GET':'POST',headers:{apikey:e.SUPABASE_SERVICE_ROLE_KEY,authorization:'Bearer '+e.SUPABASE_SERVICE_ROLE_KEY,'content-type':'application/json',Prefer:'return=minimal'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(4000)});if(!r.ok)throw Error('REFERENCE_VAULT_UNAVAILABLE');return r.status===204||r.headers.get('content-length')==='0'?null:r.json();}
const rows=await vault('scanner_qualification_observations?run_id=eq.'+run+'&candidate_sha=eq.'+sha+'&select=mint,phase,observation,captured_at');
const cold=rows.filter(r=>r.phase==='cold');if(cold.length!==20||rows.filter(r=>r.phase==='warm').length!==20||new Set(cold.map(r=>r.mint)).size!==20)throw Error('ALL_BLIND_RESULTS_MUST_PRECEDE_REFERENCE_COLLECTION');
installScannerProviderGuard();const hash=s=>createHash('sha256').update(s).digest('hex');
for(const row of cold){
 const mint=row.mint,lease=randomUUID(),admit=await vault('rpc/scanner_admit_v1',{p_client:hash('doom404-autonomous-qualification'),p_key:hash('independent:'+run+sha+mint),p_route:'token-investigation',p_id:lease});
 if(admit.status!=='ADMITTED'){console.log(JSON.stringify({mint,status:admit.status,scope:'reference_collection'}));process.exitCode=1;continue;}
 const controller=new AbortController(),ctx={lease,controller,closed:false,store:{debit:args=>vault('rpc/scanner_debit_v1',args)}},timer=setTimeout(()=>controller.abort(),34000),started=performance.now();let calls=0;
 const reference={mint,sourceProvider:'helius',sourceScope:'Independent provider receipts collected after all20 cold/warm captures; not yet independently classified.',initialScannerCapturedAt:row.captured_at,scannerAssertedCreator:row.observation.creator?.creator||null,originPage:null,tokenAccountPage:null,tokenAccountAddress:null,failures:[]};
 try{
  await scannerContext.run(ctx,async()=>{
   const rpc=async(method,params)=>{controller.signal.throwIfAborted();if(++calls>3)throw Error('REFERENCE_REQUEST_LIMIT');const r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:calls,method,params}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(3500)])});if(!r.ok)throw Error('REFERENCE_PROVIDER_UNAVAILABLE');const reader=r.body.getReader(),chunks=[];let size=0;try{while(true){const q=await reader.read();if(q.done)break;size+=q.value.byteLength;if(size>2000000){await reader.cancel();throw Error('REFERENCE_RESPONSE_LIMIT');}chunks.push(q.value);}}finally{reader.releaseLock();}const data=JSON.parse(Buffer.concat(chunks).toString());if(data.error)throw Error('REFERENCE_RPC_METHOD_UNAVAILABLE');return data.result;};
   const options={transactionDetails:'full',sortOrder:'asc',limit:12,commitment:'finalized',encoding:'jsonParsed',maxSupportedTransactionVersion:1,filters:{status:'succeeded'}};
   try{reference.originPage=await rpc('getTransactionsForAddress',[mint,options]);}catch(error){reference.failures.push({stage:'independent_mint_origin',reason:error.message});}
   const target=row.observation.creatorHistoryCheckpoint?.targetAddress;
   if(typeof target==='string'&&/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(target)){reference.tokenAccountAddress=target;try{reference.tokenAccountPage=await rpc('getTransactionsForAddress',[target,options]);}catch(error){reference.failures.push({stage:'independent_account_window',reason:error.message});}}
  });
  const status=reference.originPage?'captured_unreviewed':'retrieval_unavailable';
  await vault('scanner_qualification_references',{run_id:run,candidate_sha:sha,mint,source_provider:'helius',reference_status:status,reference,metrics:{requests:calls,providerAttempts:ctx.attempts,durationMs:Math.round(performance.now()-started),scope:'post_scan_reference_collection_only'}});
  console.log(JSON.stringify({mint,referenceStatus:status,requests:calls,originReceipts:reference.originPage?.data?.length||0,accountReceipts:reference.tokenAccountPage?.data?.length||0,persisted:true}));
 }catch(error){console.log(JSON.stringify({mint,status:'REFERENCE_COLLECTION_FAILED'}));process.exitCode=1;}
 finally{clearTimeout(timer);ctx.closed=true;controller.abort();await vault('rpc/scanner_finish_v1',{p_id:lease,p_body:null,p_status:200});}
 if(row!==cold.at(-1))await delay(4000);
}
