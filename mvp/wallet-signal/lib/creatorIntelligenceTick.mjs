import { randomUUID } from 'node:crypto';
import { createCreatorHistoryBudget } from './creatorHistoryBudget.mjs';
import { createSolanaRpcAdapter } from './creatorOriginRpc.mjs';
import { scanCreatorOrigin } from './creatorOriginPagedScan.mjs';
import { investigateCreatorHoldings } from './creatorHoldingsInvestigation.mjs';
import { summarizeCreatorSelling } from './creatorSellingEvidence.mjs';
import { discoverCreatorWalletHistory } from './creatorWalletHistoryDiscovery.mjs';
import { inspectCreatorHistoricalBatch } from './creatorHistoricalTransactionBatch.mjs';
import { summarizePreviousLaunches } from './creatorPreviousLaunches.mjs';
import { collectCreatorLaunchCandidates } from './creatorHistoricalLaunchDiscovery.mjs';
import { investigateIndexedCreatorOrigin } from './creatorIndexedOriginInvestigation.mjs';
import { fetchHeliusOldestOriginCandidates } from './heliusIndexedOriginProvider.mjs';
import { recheckCreatorOrigin } from './creatorIndependentOriginRecheck.mjs';
import { extractCreatorLaunchTime } from './creatorLaunchTimeEvidence.mjs';
import { assessCreatorInitialAllocation } from './creatorInitialAllocationEvidence.mjs';
import { assessCreatorHistoricalCoverage } from './creatorHistoricalCoverage.mjs';

/** One bounded creator-origin tick. No numeric creator score is produced.
 * Later holdings, selling and previous-launch stages remain explicitly incomplete.
 */
export async function runCreatorIntelligenceTick({mint,store,rpcUrl,fetchImpl=fetch,maxRequests=500,maxDurationMs=90000,creatorBatchSize=60,swapDecoder=null,indexedOriginEnabled=false,owner=randomUUID()}={}){
 if(!Number.isInteger(creatorBatchSize)||creatorBatchSize<1||creatorBatchSize>100)throw Error('INVALID_CREATOR_BATCH_SIZE');
 if(!store||typeof store.claim!=='function'||typeof store.get!=='function'||typeof store.save!=='function')throw Error('CREATOR_STORE_REQUIRED');
 if(!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint||''))throw Error('INVALID_MINT');
 const job=await store.get(mint);
 if(!job)throw Error('CREATOR_JOB_NOT_ENQUEUED');
 if(job.status==='complete')return {status:'complete',requests:0};
 if(job.status==='failed')return {status:'failed',requests:0};
 if(!['identification','holdings','selling','previous_launches'].includes(job.stage))return {status:'awaiting_stage_implementation',stage:job.stage,requests:0};
 if(await store.claim(mint,owner,180)!==true)return {status:'busy',requests:0};
 // Re-read the checkpoint after acquiring the lease: the pre-claim snapshot may be stale.
 const claimed=await store.get(mint);
 if(!claimed||claimed.lease_owner && claimed.lease_owner!==owner)throw Error('CREATOR_LEASE_MISMATCH');
 const budget=createCreatorHistoryBudget({maxRequests});
 const rpc=createSolanaRpcAdapter({rpcUrl,fetchImpl,sharedBudget:budget,maxRequests,maxRetries:2,pageLimit:100,minIntervalMs:250});
 const previous=claimed.state&&typeof claimed.state==='object'?claimed.state:{};
 let state={...previous,lastError:null};
 let stage=claimed.stage,status='partial',accountedRequests=0;
 try {
  if(stage==='previous_launches'){
   const creators=[...new Set((previous.originEvidence||[]).map(e=>e.creator))];
   if(creators.length!==1)throw Error('CREATOR_IDENTITY_UNRESOLVED');
   const discovery=collectCreatorLaunchCandidates({creator:creators[0],observations:previous.historicalLaunchObservations||[]});
   const launches=summarizePreviousLaunches({creator:creators[0],launches:previous.historicalLaunchEvidence||[]});
   state={...previous,lastError:null,historicalLaunchCandidates:discovery.candidates,launchDiscoveryCoverageComplete:false,previousLaunches:launches,previousLaunchesStatus:launches.previousLaunchesScoreEligible?'EVIDENCE_READY':'HISTORICAL_COVERAGE_INCOMPLETE',lastTickAt:new Date().toISOString()};
   // Never mark complete without verified historical discovery and comparable evidence.
  }else if(stage==='selling'){
   const creators=[...new Set((previous.originEvidence||[]).map(e=>e.creator))];
   if(creators.length!==1)throw Error('CREATOR_IDENTITY_UNRESOLVED');
   const history=await discoverCreatorWalletHistory({creator:creators[0],rpc,before:previous.creatorHistoryCursor||null,maxPages:3,maxSignatures:300});
   state={...previous,lastError:null,creatorHistoryCursor:history.nextCursor,
    creatorHistorySignatures:[...new Set([...(previous.creatorHistorySignatures||[]),...history.signatures])].slice(-2000),
    creatorHistoryRpcExhausted:history.rpcHistoryExhausted,creatorHistoryComplete:false,
    lastTickAt:new Date().toISOString()};
   const processed=new Set(previous.creatorProcessedSignatures||[]);
   const queue=[...new Set([...(previous.creatorPendingSignatures||[]),...(state.creatorHistorySignatures||[])])].filter(sig=>!processed.has(sig));
   const decoded=await inspectCreatorHistoricalBatch({mint,creator:creators[0],signatures:queue,rpc,maxTransactions:creatorBatchSize,swapDecoder});
   const verifiedSwapSales=[...new Map([...(previous.verifiedSwapSales||[]),...decoded.verifiedSales].map(x=>[x.signature,x])).values()];
   state={...state,verifiedSwapSales,creatorSellCandidates:[...new Map([...(previous.creatorSellCandidates||[]),...decoded.sellCandidates].map(item=>[item.signature,item])).values()].slice(-1000),creatorProcessedSignatures:[...new Set([...processed,...decoded.processed])].slice(-5000),
    creatorPendingSignatures:[...new Set([...decoded.pending,...queue.filter(sig=>!decoded.processed.includes(sig)&&!decoded.pending.includes(sig))])].slice(-5000),
    creatorTransactionObservations:[...(previous.creatorTransactionObservations||[]),...decoded.observations].slice(-1000),
    creatorSwapVerificationComplete:false,creatorHistoryComplete:false};
   // Recover launch time from the independently rechecked creation transaction.
   let verifiedLaunchTimestamp=Number(previous.launchTimestamp);
   if(!Number.isSafeInteger(verifiedLaunchTimestamp)||verifiedLaunchTimestamp<=0){
    const origin=previous.originRecheck;
    if(origin?.rechecked===true&&origin.signature){
     const creation=await rpc.fetchTransaction(origin.signature);
     const recovered=extractCreatorLaunchTime({transaction:creation,
      creationSignature:origin.signature,verifiedSignature:origin.signature});
     if(recovered.status==='CREATION_TIMESTAMP_VERIFIED'){
      verifiedLaunchTimestamp=recovered.launchTimestamp;
      state={...state,launchTimestamp:verifiedLaunchTimestamp,launchTimeEvidence:recovered};
     }
    }
   }
   const historicalCoverage=assessCreatorHistoricalCoverage({rpcExhausted:state.creatorHistoryRpcExhausted,pendingSignatures:state.creatorPendingSignatures||[],processedSignatures:state.creatorProcessedSignatures||[],archiveVerified:previous.creatorArchiveCoverageVerified===true});
   state={...state,creatorHistoricalCoverage:historicalCoverage,creatorHistoryComplete:historicalCoverage.historyComplete};
   const launchTimestamp=verifiedLaunchTimestamp;
   const allocation=Number.isSafeInteger(launchTimestamp)&&launchTimestamp>0?
    assessCreatorInitialAllocation({mint,creator:creators[0],launchTimestamp,
     distributions:previous.verifiedLaunchDistributions||[],coverageComplete:previous.launchDistributionCoverageComplete===true}):null;
   if(allocation)state={...state,initialAllocationEvidence:allocation};
   const initialAttributableRaw=allocation?.initialAttributableRaw??null;
   if(!Number.isSafeInteger(launchTimestamp)||launchTimestamp<=0||!/^[0-9]+$/.test(String(initialAttributableRaw||''))){
    state={...state,sellingStatus:launchTimestamp>0?'AWAITING_VERIFIED_INITIAL_ALLOCATION':'AWAITING_VERIFIED_LAUNCH_TIME',lastTickAt:new Date().toISOString()};
   }else{
    const selling=summarizeCreatorSelling({launchTimestamp,initialAttributableRaw,transactions:state.verifiedSwapSales||[],historyCompleteByWindow:previous.historyCompleteByWindow||{}});
    state={...state,selling,sellingStatus:selling.creatorSellingScoreEligible?'EVIDENCE_READY':'HISTORICAL_COVERAGE_INCOMPLETE',lastTickAt:new Date().toISOString()};
    if(selling.creatorSellingScoreEligible)stage='previous_launches';
   }
  }else if(stage==='holdings'){
   const evidence=previous.originEvidence||[];
   const creators=[...new Set(evidence.map(x=>x.creator))];
   if(creators.length!==1)throw Error('CREATOR_IDENTITY_UNRESOLVED');
   const review=await recheckCreatorOrigin({mint,evidence,rpc});
   if(!review.rechecked){
    state={...previous,lastError:null,originRecheck:review,identificationStatus:'ONCHAIN_MATCH_PENDING_INDEPENDENT_REVIEW',lastTickAt:new Date().toISOString()};
   }else{
   const creationTx=await rpc.fetchTransaction(review.signature);
   const launch=extractCreatorLaunchTime({transaction:creationTx,creationSignature:review.signature,verifiedSignature:evidence[0].signature});
   const holdings=await investigateCreatorHoldings({mint,creator:creators[0],rpc});
   state={...previous,lastError:null,originRecheck:review,identificationStatus:'ONCHAIN_CREATOR_RECHECKED',launchTimeEvidence:launch,
    ...(launch.launchTimestamp?{launchTimestamp:launch.launchTimestamp}:{}),holdings,lastTickAt:new Date().toISOString()};
   stage='selling';
   }
  }else{
  // Reserve the paid call durably before contacting Helius. A crash must not trigger a second charge.
  let provider={status:'NOT_REQUESTED',candidates:[]};
  if(indexedOriginEnabled && !previous.indexedOriginLookupAttempted){
   state={...state,indexedOriginLookupAttempted:true,indexedOriginProviderStatus:'RESERVED',indexedOriginReservedAt:new Date().toISOString()};
   await store.save({mint,owner,stage,status:'running',state,requestCount:0});
   try{
    provider=await fetchHeliusOldestOriginCandidates({mint,rpcUrl,fetchImpl,budget,enabled:true,limit:5});
   }catch(error){
    provider={status:'LOOKUP_FAILED',candidates:[]};
    if(error?.message==='CREATOR_REQUEST_BUDGET_EXHAUSTED')throw error;
   }
   state={...state,indexedOriginProviderStatus:provider.status,
    indexedOriginCandidates:[...(previous.indexedOriginCandidates||[]),...provider.candidates].slice(0,50)};
   await store.save({mint,owner,stage,status:'running',state,requestCount:budget.used});
   accountedRequests=budget.used;
  }
  const candidates=[...(state.indexedOriginCandidates||previous.indexedOriginCandidates||[])];
  const indexed=await investigateIndexedCreatorOrigin({mint,candidates:candidates.filter(x=>!(previous.indexedOriginChecked||[]).includes(x.signature)),rpc,limit:10});
  const scan=await scanCreatorOrigin({mint,before:previous.nextCursor||null,
   lookupSignaturePage:rpc.lookupSignaturePage,fetchTransaction:rpc.fetchTransaction,
   maxPages:5,maxTransactions:100,maxDurationMs:Math.min(maxDurationMs,120000)});
  const deferred=[...new Set([...(previous.deferredSignatures||[]),...scan.deferredSignatures])].slice(-1000);
  state={...previous,lastError:null,nextCursor:scan.nextCursor,
   indexedOriginLookupAttempted:state.indexedOriginLookupAttempted||previous.indexedOriginLookupAttempted||false,
   indexedOriginProviderStatus:state.indexedOriginProviderStatus||previous.indexedOriginProviderStatus||'NOT_REQUESTED',
   indexedOriginCandidates:candidates.slice(0,50),
   indexedOriginChecked:[...new Set([...(previous.indexedOriginChecked||[]),...indexed.checked])].slice(-1000),
   indexedOriginDeferred:[...new Set([...(previous.indexedOriginDeferred||[]),...indexed.deferred])].slice(-1000),
   deferredSignatures:deferred,
   pagesFetched:(previous.pagesFetched||0)+scan.pagesFetched,
   sampled:(previous.sampled||0)+scan.sampled,
   originEvidence:[...new Map([...(previous.originEvidence||[]),...indexed.proofs,...scan.verified].map(v=>[v.signature+':'+v.creator,v])).values()].slice(-100),
   rpcHistoryExhausted:scan.rpcHistoryExhausted,
   historyComplete:false,lastTickAt:new Date().toISOString()};
  if(state.originEvidence.length>0){stage='holdings';state.identificationStatus='ONCHAIN_MATCH_PENDING_INDEPENDENT_REVIEW';}
  else if(scan.rpcHistoryExhausted)state.identificationStatus='UNRESOLVED_ARCHIVE_NOT_PROVEN';
  else state.identificationStatus='INCOMPLETE';
  }
 }catch(error){
  const safeReasons=new Set(['CREATOR_REQUEST_BUDGET_EXHAUSTED','RPC_REQUEST_BUDGET_EXHAUSTED','PAGINATION_STALLED','RPC_RATE_LIMITED','RPC_HTTP_ERROR','RPC_RESPONSE_ERROR','RPC_AUTH_FAILED','INVALID_SIGNATURE_PAGE','INVALID_SIGNATURE_RESPONSE','CREATOR_IDENTITY_UNRESOLVED','HOLDINGS_EVIDENCE_INCOMPLETE']);
  const errorCode=safeReasons.has(error?.message)?error.message:'CREATOR_TICK_ERROR';
  state={...state,lastError:errorCode,lastTickAt:new Date().toISOString()};
  status='partial';
 }
 await store.save({mint,owner,stage,status,state,requestCount:budget.used-accountedRequests});
 return {status,stage,requests:budget.used,identificationStatus:state.identificationStatus||'INCOMPLETE',errorCode:state.lastError||null};
}
