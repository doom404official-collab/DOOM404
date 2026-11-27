import {RISK_WEIGHTS,RISK_METHODOLOGY_VERSION} from './riskMethodology.mjs';
import {publicInvestigation} from './tokenInvestigationStore.mjs';
import {projectHolderRelationshipsV2} from './holderRelationshipsV2.mjs';
import {projectCreatorBehaviourV2} from './creatorBehaviourV2.mjs';
import {projectPumpLiquidityV2} from './pumpLiquidityAssessmentV2.mjs';
import {projectCreatorWalletObservation} from './creatorWalletObservation.mjs';
import {projectCurrentPoolReserves} from './currentPoolReserves.mjs';
import {summarizeCreatorAcquisitionLedger} from './creatorAcquisitionLedger.mjs';
import {projectLiquidityScoring} from './liquidityScoringProjection.mjs';
import {projectCurrentLpObservation} from './currentLpObservation.mjs';
import {validateLiquidityCheckpoint} from './liquidityEvidenceCheckpoint.mjs';
import {reconcileCreatorLaunchTransaction} from './creatorLaunchTransactionReconciliation.mjs';
import {CANONICAL_HOLDER_BASELINE,projectCanonicalHolderObservation} from './canonicalHolderObservation.mjs';
import {summarizeCreatorSellingLedger} from './creatorSellingLedgerEvidence.mjs';
import {reconcileLiquidityLq09} from './liquidityLq09Reconciliation.mjs';
/** Read-only projections of existing worker checkpoints. Never expose raw state,
 * leases, provider errors, credentials, or candidate transactions to the client. */
const address=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const finite=(v,max=100)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max;
const count=v=>Number.isSafeInteger(v)&&v>=0?v:null;
const stamp=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))?v:null;
function creatorLedgerConsistent(state,mint,creator){
 const saved=state.creatorAcquisitionLedger;
 if(!creator||!saved||saved.status!=='EVIDENCE_READY'||saved.scoreEligible!==true||
  saved.historyComplete!==true||saved.attributionComplete!==true||state.creatorRetentionBlocked||
  !Array.isArray(state.creatorVerifiedAcquisitionEvents)||!Array.isArray(saved.rejected)||saved.rejected.length)return false;
 try{
  const actual=summarizeCreatorAcquisitionLedger({mint,creator,events:state.creatorVerifiedAcquisitionEvents,
   historyComplete:state.creatorHistoryComplete===true,attributionComplete:state.creatorAcquisitionAttributionComplete===true});
  return actual.scoreEligible===true&&['acceptedCount','launchRaw','purchasedRaw','externalReceivedRaw','externalTransferredOutRaw',
   'verifiedSoldRaw','totalAcquiredRaw','reconciledRemainingRaw','sellThroughPct'].every(field=>saved[field]===actual[field])&&(saved.burnedRaw??'0')===actual.burnedRaw;
 }catch{return false;}
}
export function projectCreatorCheckpoint(row,mint){
 if(!row)return {status:'not_started',mint};
 if(row.mint!==mint||!row.state||typeof row.state!=='object')throw Error('CREATOR_CHECKPOINT_MISMATCH');
 const s=row.state,h=s.holdings;
 const creators=[...new Set((Array.isArray(s.originEvidence)?s.originEvidence:[]).map(e=>e?.creator).filter(x=>address.test(x||'')))];
 const creator=creators.length===1?creators[0]:null;
 const retainedLaunch=creator&&s.launchReconciliationTransaction?reconcileCreatorLaunchTransaction({mint,creator,signature:s.originRecheck?.signature,transaction:s.launchReconciliationTransaction}):null;
 const launchObservation=retainedLaunch?.status==='VERIFIED_TRANSACTION_LOCAL_LAUNCH'?{
  schemaVersion:1,signature:retainedLaunch.signature,slot:retainedLaunch.slot,
  creator,purchasedRaw:retainedLaunch.event.amountRaw,decimals:6,
  zeroDirectLaunchAllocationVerified:retainedLaunch.initialAllocationEvidence.zeroAllocationVerified,
  timestamp:retainedLaunch.event.timestamp,historyComplete:false,scoreEligible:false}:null;
 const holdings=h?.mint===mint&&h?.creator===creator&&h.status==='ONCHAIN_BALANCE_OBSERVED'?{
  creator,supplySharePct:finite(h.supplySharePct)?h.supplySharePct:null,
  observedAt:stamp(h.balanceObservedAt),scoreEligible:false}:null;
 // No verified attribution-complete holdings denominator or prior-launch point
 // producer exists yet. A wallet balance and launch count must not fill those.
 const selling=s.selling,allocation=s.initialAllocationEvidence;
 const windows=Array.isArray(selling?.windows)?selling.windows:[];
 let ledgerSellingComplete=false;
 if(selling?.methodology==='CREATOR_SELLING_LEDGER_V2'&&retainedLaunch?.status==='VERIFIED_TRANSACTION_LOCAL_LAUNCH'&&allocation?.zeroAllocationVerified===true&&allocation?.initialAttributableRaw==='0'&&s.creatorHistoricalCoverage?.archiveVerified===true&&s.creatorHistoricalCoverage?.historyComplete===true){
  const actual=summarizeCreatorSellingLedger({mint,creator,launchTimestamp:retainedLaunch.event.timestamp,events:s.creatorVerifiedAcquisitionEvents||[],historyCompleteByWindow:s.historyCompleteByWindow||{},archiveVerified:true,attributionComplete:s.creatorAcquisitionAttributionComplete===true});
  ledgerSellingComplete=actual.creatorSellingScoreEligible===true&&selling.creatorSellingScoreEligible===true&&selling.archiveVerified===true&&windows.length===3&&actual.windows.every(w=>{
   const matched=windows.filter(x=>x.seconds===w.seconds);return matched.length===1&&['denominatorRaw','verifiedSoldRaw','burnedRaw','externalTransferredOutRaw','historyComplete','scoreEligible','sellThroughPct'].every(k=>matched[0][k]===w[k]);
  });
 }
 const legacySellingComplete=
  /^\d+$/.test(allocation?.initialAttributableRaw||'')&&BigInt(allocation.initialAttributableRaw)>0n&&
  selling?.methodology==='CREATOR_SELLING_V1_1'&&selling.creatorSellingScoreEligible===true&&
  [3600,86400,604800].every(seconds=>windows.filter(w=>w.seconds===seconds).length===1&&
   windows.some(w=>w.seconds===seconds&&w.historyComplete===true&&w.scoreEligible===true&&finite(w.sellThroughPct)&&/^\d+$/.test(w.verifiedSoldRaw||'')&&
    w.sellThroughPct===Number(BigInt(w.verifiedSoldRaw)*1000000n/BigInt(allocation.initialAttributableRaw))/10000));
 const complete=creatorLedgerConsistent(s,mint,creator)&&s.creatorHistoryComplete===true&&allocation?.status==='INITIAL_ALLOCATION_EVIDENCE_COMPLETE'&&allocation?.coverageComplete===true&&(ledgerSellingComplete||legacySellingComplete);
 return {mint,status:['queued','running','partial','complete','failed'].includes(row.status)?row.status:'unknown',
  stage:['identification','holdings','selling','previous_launches','complete'].includes(row.stage)?row.stage:'unknown',
  updatedAt:stamp(row.updated_at),creator,holdings,launchObservation,
  currentWalletObservation:projectCreatorWalletObservation(s.currentWalletAccountsObservation,mint,creator),
  behaviourV2:projectCreatorBehaviourV2(s,mint,creator),
  selling:complete?{historyComplete:true,percentages:[3600,86400,604800].map(seconds=>windows.find(w=>w.seconds===seconds).sellThroughPct)}:null,
  previousLaunchCount:count(s.previousLaunches?.attributedLaunchCount),
  missing:['Verified creator/team holdings attribution','Comparable previous-launch scoring evidence',...(!complete?[retainedLaunch?.status==='VERIFIED_TRANSACTION_LOCAL_LAUNCH'?'Complete archival selling windows and acquisition attribution':'Verified initial allocation and complete selling windows']:[])]};
}
export function projectLiquidityCheckpoint(row,mint){
 if(!row)return {status:'not_started',mint};
 const e=row.evidence;
 if(row.mint!==mint||!e||e.mint!==mint||![1,2].includes(e.schemaVersion)||!Array.isArray(e.pools)||!Array.isArray(e.batchErrors))throw Error('LIQUIDITY_CHECKPOINT_UNSUPPORTED');
 if(e.schemaVersion===1&&(e.finalScore!==null||e.verifiedDepth!==false||e.lpSecurityVerified!==false))throw Error('LIQUIDITY_CHECKPOINT_UNSUPPORTED');
 validateLiquidityCheckpoint(e);
 const scoring=e.schemaVersion===2?projectLiquidityScoring(e,mint):null;
 let lq09Observation=null;
 try{if(e.lq09Reconciliation?.raw){const r=reconcileLiquidityLq09(e.lq09Reconciliation.raw);if(r.mint===mint)lq09Observation={schemaVersion:1,mint,transactionSlot:r.transactionSlot,observedAt:r.observedAt,amountReconciled:r.amounts.amountReconciled,totalTransferRaw:r.amounts.totalTransferRaw,creatorRecipientMatchesHistoricalState:r.creatorRecipientMatchesHistoricalState,protocolRecipientMatchesHistoricalState:r.protocolRecipientMatchesHistoricalState,authorizationVerified:false,withdrawalConfirmed:false,scoreEligible:false,historicalAccountReads:r.historicalAccountReads};}}catch{}
 return {mint,schemaVersion:e.schemaVersion,status:['partial','account_checks_completed','complete'].includes(e.status)?e.status:'unknown',
  updatedAt:stamp(row.updated_at),observedAt:stamp(e.observedAt),checkedPoolCount:e.pools.length,
  reportedPoolCount:count(e.providerReportedPools),failedBatchCount:e.batchErrors.length,
  lpObservation:projectCurrentLpObservation(e.currentLpObservation,mint),lq09Observation,
  reserveObservation:projectCurrentPoolReserves(e.currentPoolReserves,mint),
  currentScoringV2:projectPumpLiquidityV2(e.practicalScoringEvidenceV2,mint),
  ...(scoring?{scoringEvidence:{...scoring,mint,provenance:scoring.provenance.map(p=>({...p,mint,validated:true,coverageComplete:true}))},finalScore:e.finalScore,verifiedDepth:e.verifiedDepth,lpSecurityVerified:e.lpSecurityVerified}:{}),
  missing:scoring?scoring.assessment.components.filter(c=>c.points===null).map(c=>c.id):['Verified executable depth and market cap','Verified LP withdrawal control','Independent pool concentration','Verified reference sell impact','30-day reserve history']};
}
export async function readDashboardEvidence({mint,url,key,fetchImpl=fetch}={}){
 if(!address.test(mint||''))throw Error('INVALID_MINT');
 if(!/^https:\/\//.test(url||'')||!key)throw Error('EVIDENCE_STORAGE_UNAVAILABLE');
 async function read(table,select,project,extra=''){
  // Leave 3 seconds within the client's unchanged 12-second response deadline.
  // Race the entire read, including body parsing, even if transport ignores abort.
  const controller=new AbortController();let timer;
  const expired=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('READ_TIMEOUT'));},9000);});
  try{
   return await Promise.race([(async()=>{
   const response=await fetchImpl(url.replace(/\/$/,'')+'/rest/v1/'+table+'?mint=eq.'+encodeURIComponent(mint)+'&select='+select+'&limit=1'+extra,{
    method:'GET',headers:{apikey:key,Authorization:'Bearer '+key},cache:'no-store',signal:controller.signal});
   if(!response.ok)throw Error('READ_FAILED');
   const rows=await response.json();
   if(!Array.isArray(rows)||rows.length>1)throw Error('INVALID_RESPONSE');
   if(controller.signal.aborted)throw Error('READ_TIMEOUT');
   return project(rows[0],mint);
   })(),expired]);
  }catch{return {mint,status:'unavailable',missing:['Persisted evidence unavailable or incompatible']};}
  finally{clearTimeout(timer);controller.abort();}
 }
 let retainedCreatorRow=null;
 const [creator,liquidity,canonicalHolder,holderRelationships,investigation]=await Promise.all([
  read('creator_intelligence_jobs','mint,status,stage,state,updated_at',(row,mint)=>{retainedCreatorRow=row;return projectCreatorCheckpoint(row,mint);}),
  read('liquidity_evidence_checkpoints','mint,evidence,updated_at',projectLiquidityCheckpoint),
  mint===CANONICAL_HOLDER_BASELINE.mint?read('glitch_top20_snapshots','id,mint,status,snapshot_slot,supply_raw,holder_ranking,observation',projectCanonicalHolderObservation,'&id=eq.'+CANONICAL_HOLDER_BASELINE.snapshotId):Promise.resolve({mint,status:'not_started'}),
  mint===CANONICAL_HOLDER_BASELINE.mint?read('glitch_holder_scan_jobs','mint,holder_set_hash,version,checkpoint,updated_at',projectHolderRelationshipsV2,'&id=eq.49feee9f-7c79-4d6f-9767-151db38e1fca'):Promise.resolve(null),
  read('scanner_token_investigations','mint,status,observation,updated_at,lease_until,expires_at',row=>publicInvestigation(row))]);
 const freshCreator=investigation?.mint===mint&&investigation.creator?.attribution?.verified===true&&(!creator.creator||creator.creator===investigation.creator.creator)?investigation.creator:null;
 const mergedBehaviour=freshCreator?projectCreatorBehaviourV2({...retainedCreatorRow?.state,creatorVerifiedAcquisitionEvents:[...(retainedCreatorRow?.state?.creatorVerifiedAcquisitionEvents||[]),...(freshCreator.events||[])],creatorProcessedSignatures:[...new Set([...(retainedCreatorRow?.state?.creatorProcessedSignatures||[]),...(freshCreator.behaviourV2?.signatures||[])])]},mint,freshCreator.creator):null;
 if(mergedBehaviour)mergedBehaviour.processedHistoricalSignatures=Math.max(mergedBehaviour.processedHistoricalSignatures,freshCreator.behaviourV2.processedHistoricalSignatures);
 return {version:'1.1',methodologyVersion:RISK_METHODOLOGY_VERSION,weights:RISK_WEIGHTS,mint,creator:freshCreator?{...creator,mint,attribution:freshCreator.attribution,behaviourV2:mergedBehaviour}:creator,
  liquidity,canonicalHolder,holderRelationships:holderRelationships||investigation?.holderRelationships||null,investigation};
}
