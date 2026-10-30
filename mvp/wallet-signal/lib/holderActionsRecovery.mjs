import {setTimeout as delay} from 'node:timers/promises';
import {readHolderRecoveryWindow,recoveryWindowOpen} from './holderRecoveryWindow.mjs';
import {createHolderRecoveryBudget,assertHolderBudgetSignal} from './holderRecoveryBudget.mjs';
import {createHolderJobStore} from './holderJobStore.mjs';
import {assertPinnedHolderRecovery} from './holderRecoveryGuard.mjs';
import {runPinnedHolderRecovery} from './holderPinnedRecovery.mjs';
const repository='doom404official-collab/DOOM404';
const branch='refs/heads/fix/glitch-recovery-preflight-20261027';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const jobs=Object.freeze(['c670f393-31b0-470c-a01f-cb2b813a1219','d07c0256-b472-4089-a237-99ed5e5c8cc4']);
const shaPattern=/^[0-9a-f]{40}$/;
export function validateHolderActionsRecovery(env,checkedOutSha,now=Date.now()){
 if(env.HOLDER_MANUAL_MODE!=='recovery'||env.GITHUB_ACTIONS!=='true'||env.GITHUB_EVENT_NAME!=='workflow_dispatch'||env.GITHUB_REPOSITORY!==repository||env.GITHUB_REF!==branch||env.GITHUB_RUN_ATTEMPT!=='1')throw Error('EXECUTION_SCOPE_INVALID');
 if(!shaPattern.test(env.HOLDER_EXPECTED_SHA||'')||env.GITHUB_SHA!==env.HOLDER_EXPECTED_SHA||checkedOutSha!==env.HOLDER_EXPECTED_SHA)throw Error('REVIEWED_SHA_MISMATCH');
 const window=readHolderRecoveryWindow(env,now);
 if(typeof env.SUPABASE_SERVICE_ROLE_KEY!=='string'||!env.SUPABASE_SERVICE_ROLE_KEY.trim()||env.SUPABASE_SERVICE_ROLE_KEY!==env.SUPABASE_SERVICE_ROLE_KEY.trim())throw Error('CREDENTIAL_MISSING');
 let database,provider;
 try{database=new URL(env.SUPABASE_URL);provider=new URL(env.HELIUS_RPC_URL);}catch{throw Error('DESTINATION_INVALID');}
 if(database.protocol!=='https:'||database.hostname!=='acwmtobcbpkjfqiatyke.supabase.co'||database.port||database.username||database.password||database.hash||database.search||!['','/'].includes(database.pathname))throw Error('PROJECT_MISMATCH');
 if(provider.protocol!=='https:'||provider.hostname!=='mainnet.helius-rpc.com'||provider.port||provider.username||provider.password||provider.hash||provider.pathname!=='/'||[...provider.searchParams.keys()].length!==1||!provider.searchParams.get('api-key')?.trim())throw Error('PROVIDER_DESTINATION_INVALID');
 return {window,database:database.origin,provider:provider.href,sha:checkedOutSha};
}
/** Two sequential pinned attempts; no scheduler, creation, retries or provider probes. */
export async function runHolderActionsRecovery({env=process.env,checkedOutSha,fetchImpl=fetch,sleep=delay,now=Date.now}={}){
 const receipt={schemaVersion:1,reviewedSha:shaPattern.test(checkedOutSha||'')?checkedOutSha:null,status:'blocked',stopReason:null,requestCount:0,jobs:[],reconciliationRequired:false,retries:0,historyComplete:false,scorePromoted:false};
 let config,mutationStarted=false,phase='CONFIGURATION';
 try{
  config=validateHolderActionsRecovery(env,checkedOutSha,now());
  const databaseFetch=async(url,options)=>{
   if(!recoveryWindowOpen(config.window,now()))throw Error('WINDOW_CLOSED');
   const u=new URL(url);
   if(u.origin!==config.database)throw Error('PROJECT_MISMATCH');
   const read=u.pathname==='/rest/v1/glitch_holder_scan_jobs'&&options.method==='GET';
   const write=['/rest/v1/rpc/glitch_claim_holder_scan','/rest/v1/rpc/glitch_renew_holder_scan','/rest/v1/rpc/glitch_commit_holder_scan'].includes(u.pathname)&&options.method==='POST';
   if(!read&&!write)throw Error('STORE_OPERATION_INVALID');
   assertHolderBudgetSignal(options.signal);
   if(write)mutationStarted=true;
   return fetchImpl(url,{...options,redirect:'error'});
  };
  const store=createHolderJobStore({url:config.database,key:env.SUPABASE_SERVICE_ROLE_KEY,fetchImpl:databaseFetch});
  phase='PREFLIGHT';
  // Validate both retained jobs before the first mutation; adapter rechecks each at use.
  const preflight=createHolderRecoveryBudget({notAfter:config.window.expiresAt,wallNow:now});
  for(const jobId of jobs){
   const row=await preflight.run('READ',signal=>store.getById(jobId,{signal}));
   assertPinnedHolderRecovery({job:row,jobId,mint,version:config.window.versions[jobId],now:new Date(now())});
  }
  phase='ATTEMPT';
  for(const jobId of jobs){
   if(!recoveryWindowOpen(config.window,now()))throw Error('WINDOW_CLOSED');
   const item={jobId,expectedVersion:config.window.versions[jobId],resultVersion:null,requestCount:0,status:'interrupted',reconciliationRequired:false};
   receipt.jobs.push(item);let providerFailed=false,last=0;
   const budget=createHolderRecoveryBudget({notAfter:config.window.expiresAt,wallNow:now});
   let result;
   try{
    result=await runPinnedHolderRecovery({store,jobId,mint,expectedVersion:item.expectedVersion,maxRequests:20,leaseSeconds:90,budget,rpc:async(method,params,{signal})=>{
     if(!['getTransaction','getSignaturesForAddress'].includes(method))throw Error('PROVIDER_METHOD_INVALID');
     assertHolderBudgetSignal(signal);
     const pause=Math.max(0,450-(now()-last));if(pause)await sleep(pause,undefined,{signal});
     const requestId=receipt.requestCount+1;
     const body=JSON.stringify({jsonrpc:'2.0',id:requestId,method,params});
     assertHolderBudgetSignal(signal);
     if(!recoveryWindowOpen(config.window,now())||item.requestCount>=20||receipt.requestCount>=40)throw Error('REQUEST_LIMIT');
     item.requestCount++;receipt.requestCount++;last=now();
     try{
      const response=await fetchImpl(config.provider,{method:'POST',headers:{'Content-Type':'application/json'},body,signal,redirect:'error'});
      if(!response.ok)throw Error('PROVIDER_UNAVAILABLE');
      const data=await response.json();
      if(!data||data.jsonrpc!=='2.0'||data.id!==requestId||data.error||!Object.hasOwn(data,'result'))throw Error('PROVIDER_UNAVAILABLE');
      return data.result;
     }catch{providerFailed=true;throw Error('PROVIDER_UNAVAILABLE');}
    }});
   }catch{
    item.reconciliationRequired=mutationStarted;receipt.reconciliationRequired=mutationStarted;receipt.status='stopped';receipt.stopReason='ATTEMPT_INTERRUPTED';return receipt;
   }
   const statuses=['partial','complete','ALREADY_CLAIMED','LEASE_LOST','VERSION_CONFLICT','CLAIM_OUTCOME_UNKNOWN','RENEWAL_OUTCOME_UNKNOWN','COMMIT_OUTCOME_UNKNOWN'];
   item.status=statuses.includes(result.status)?result.status:'interrupted';
   item.resultVersion=Number.isSafeInteger(result.version)?result.version:null;
   if(result.status==='COMMIT_OUTCOME_UNKNOWN')item.commitDiagnostic=result.commitDiagnostic;
   item.reconciliationRequired=result.reconciliationRequired===true||!['partial','complete'].includes(item.status);
   if(item.reconciliationRequired||providerFailed){receipt.status='stopped';receipt.stopReason=item.reconciliationRequired?'RECONCILIATION_REQUIRED':'PROVIDER_UNAVAILABLE';receipt.reconciliationRequired=item.reconciliationRequired;return receipt;}
  }
  receipt.status='attempts_finished';return receipt;
 }catch{
  receipt.status=mutationStarted?'stopped':'blocked';receipt.stopReason=phase+'_FAILED';receipt.reconciliationRequired=mutationStarted;return receipt;
 }
}
