// Server-only request admission. A public GET must never trigger costly RPC work.
// This gate deliberately fails closed until durable distributed quotas are connected.
export function decidePublicDeepScan({mint,featureEnabled=false,authenticated=false,quotaGranted=false,activeJob=null}={}){
 const valid=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint??'');
 if(!valid)return {allowed:false,status:400,reason:'invalid_mint'};
 if(activeJob&&['queued','running','partial'].includes(activeJob.status))
  return {allowed:false,status:202,reason:'existing_job',jobId:activeJob.id};
 if(!featureEnabled)return {allowed:false,status:503,reason:'public_deep_scan_disabled'};
 if(!authenticated)return {allowed:false,status:401,reason:'authentication_required'};
 if(!quotaGranted)return {allowed:false,status:429,reason:'quota_unavailable'};
 return {allowed:true,status:202,reason:'admitted'};
}
