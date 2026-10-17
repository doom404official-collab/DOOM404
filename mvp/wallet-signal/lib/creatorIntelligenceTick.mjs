import { randomUUID } from 'node:crypto';
import { createCreatorHistoryBudget } from './creatorHistoryBudget.mjs';
import { createSolanaRpcAdapter } from './creatorOriginRpc.mjs';
import { scanCreatorOrigin } from './creatorOriginPagedScan.mjs';

/** One bounded creator-origin tick. No numeric creator score is produced.
 * Later holdings, selling and previous-launch stages remain explicitly incomplete.
 */
export async function runCreatorIntelligenceTick({mint,store,rpcUrl,fetchImpl=fetch,maxRequests=500,maxDurationMs=90000,owner=randomUUID()}={}){
 if(!store||typeof store.claim!=='function'||typeof store.get!=='function'||typeof store.save!=='function')throw Error('CREATOR_STORE_REQUIRED');
 if(!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint||''))throw Error('INVALID_MINT');
 const job=await store.get(mint);
 if(!job)throw Error('CREATOR_JOB_NOT_ENQUEUED');
 if(job.status==='complete')return {status:'complete',requests:0};
 if(job.status==='failed')return {status:'failed',requests:0};
 if(job.stage!=='identification')return {status:'awaiting_stage_implementation',stage:job.stage,requests:0};
 if(await store.claim(mint,owner,180)!==true)return {status:'busy',requests:0};
 const budget=createCreatorHistoryBudget({maxRequests});
 const rpc=createSolanaRpcAdapter({rpcUrl,fetchImpl,sharedBudget:budget,maxRequests,maxRetries:2,pageLimit:100,minIntervalMs:250});
 const previous=job.state&&typeof job.state==='object'?job.state:{};
 let state={...previous};
 let stage='identification',status='partial';
 try {
  const scan=await scanCreatorOrigin({mint,before:previous.nextCursor||null,
   lookupSignaturePage:rpc.lookupSignaturePage,fetchTransaction:rpc.fetchTransaction,
   maxPages:5,maxTransactions:100,maxDurationMs:Math.min(maxDurationMs,120000)});
  const deferred=[...new Set([...(previous.deferredSignatures||[]),...scan.deferredSignatures])].slice(-1000);
  state={...previous,nextCursor:scan.nextCursor,deferredSignatures:deferred,
   pagesFetched:(previous.pagesFetched||0)+scan.pagesFetched,
   sampled:(previous.sampled||0)+scan.sampled,
   originEvidence:[...new Map([...(previous.originEvidence||[]),...scan.verified].map(v=>[v.signature+':'+v.creator,v])).values()].slice(-100),
   rpcHistoryExhausted:scan.rpcHistoryExhausted,
   historyComplete:false,lastTickAt:new Date().toISOString()};
  if(state.originEvidence.length>0){stage='holdings';state.identificationStatus='ONCHAIN_MATCH_PENDING_INDEPENDENT_REVIEW';}
  else if(scan.rpcHistoryExhausted)state.identificationStatus='UNRESOLVED_ARCHIVE_NOT_PROVEN';
  else state.identificationStatus='INCOMPLETE';
 }catch(error){
  state={...previous,lastError:['CREATOR_REQUEST_BUDGET_EXHAUSTED','RPC_REQUEST_BUDGET_EXHAUSTED'].includes(error?.message)?'REQUEST_BUDGET_EXHAUSTED':'CREATOR_TICK_ERROR',lastTickAt:new Date().toISOString()};
 }
 await store.save({mint,owner,stage,status,state,requestCount:budget.used});
 return {status,stage,requests:budget.used,identificationStatus:state.identificationStatus||'INCOMPLETE'};
}
