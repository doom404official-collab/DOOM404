import {createHolderRecoveryBudget} from './holderRecoveryBudget.mjs';
import {processHolderScanJob} from './holderScanWorker.mjs';
import {isDeepStrictEqual} from 'node:util';
// Same 60s platform envelope as pinned recovery, without pinned selection policy.
export const createHolderWorkerBudget=createHolderRecoveryBudget;
export function boundedHolderStore(store,budget,methods,state){
 return Object.fromEntries(Object.entries(methods).map(([name,{write=false,label=name.toUpperCase()}])=>[name,async(...args)=>{
  state.stage=label;
  try{return await budget.run(label,signal=>store[name](...args,{signal}));}
  catch(error){if(write)state.uncertain=label;throw error;}
 }]));
}
export function holderExecutionFailure(state,{jobId,requestCount=0}={}){
 return {status:state.uncertain?state.uncertain+'_OUTCOME_UNKNOWN':'EXECUTION_INTERRUPTED',stage:state.stage,
  ...(jobId?{jobId}:{}),requestCount,reconciliationRequired:true,retryAllowed:false};
}
export async function runBoundedHolderWorker({store,jobId,rpc,maxRequests,leaseSeconds=90,budget=createHolderWorkerBudget()}={}){
 if(!Number.isInteger(maxRequests)||maxRequests<1||maxRequests>35)throw Error('INVALID_WORKER_LIMIT');
 const state={stage:'CLAIM'};let requests=0,claim,worker,version;
 const bounded=boundedHolderStore(store,budget,{claim:{write:true},renew:{write:true},commit:{write:true}},state);
 const live=(row,v)=>row?.id===jobId&&row.mint===claim?.mint&&row.status==='running'&&row.version===v&&row.lease_owner===worker&&typeof row.lease_expires_at==='string'&&Date.parse(row.lease_expires_at)>Date.now();
 const guarded={
  async claim(id,owner,seconds){
   worker=owner;const row=await bounded.claim(id,owner,seconds);if(!row)return null;
   claim=row;
   if(!Number.isSafeInteger(row.version)||row.version<0||!live(row,row.version)||!row.checkpoint||row.checkpoint.mint!==row.mint){state.uncertain='CLAIM';throw Error('INVALID_CLAIM');}
   version=row.version;
   // Clone and validate CPU completion inside the budget; late parsing never starts RPC.
   claim=await budget.run('CHECKPOINT',()=>structuredClone(row));
   return {...claim,checkpoint:structuredClone(claim.checkpoint)};
  },
  async renew(id,owner,v,seconds){
   if(id!==jobId||owner!==worker||v!==version)throw Error('INVALID_RENEW_INPUT');
   const row=await bounded.renew(id,owner,v,seconds);if(!row)return null;
   if(!live(row,v+1)||!isDeepStrictEqual(row.checkpoint,claim.checkpoint)){state.uncertain='RENEW';throw Error('INVALID_RENEW_RESPONSE');}
   version=row.version;return row;
  },
  async commit(id,owner,v,checkpoint,summary,status){
   if(id!==jobId||owner!==worker||v!==version||checkpoint.mint!==claim.mint)throw Error('INVALID_COMMIT_INPUT');
   summary={...claim.summary,...summary};
   const row=await bounded.commit(id,owner,v,checkpoint,summary,status);if(!row)return null;
   if(row.id!==jobId||row.mint!==claim.mint||row.version!==v+1||row.status!==status||row.lease_owner!==null||row.lease_expires_at!==null||!isDeepStrictEqual(row.checkpoint,checkpoint)||!isDeepStrictEqual(row.summary,summary)){state.uncertain='COMMIT';throw Error('INVALID_COMMIT_RESPONSE');}
   return row;
  }
 };
 try{
  const result=await processHolderScanJob({store:guarded,jobId,maxRequests,leaseSeconds,rpc:(method,params)=>{
   if(Date.now()>=Date.parse(claim.lease_expires_at))throw Error('WORKER_LEASE_EXPIRED');
   return budget.run('PROVIDER',signal=>{if(requests>=maxRequests)throw Error('WORKER_REQUEST_LIMIT');requests++;return rpc(method,params,{signal});},{provider:true});
  }});
  return {...result,jobId,requestCount:requests,...(['LEASE_LOST','VERSION_CONFLICT'].includes(result.status)?{reconciliationRequired:true,retryAllowed:false}:{})};
 }catch{return holderExecutionFailure(state,{jobId,requestCount:requests});}
}
