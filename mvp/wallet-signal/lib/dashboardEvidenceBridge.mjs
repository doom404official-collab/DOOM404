import {summarizeCreatorAcquisitionLedger} from './creatorAcquisitionLedger.mjs';
import {projectLiquidityScoring} from './liquidityScoringProjection.mjs';
import {projectCurrentLpObservation} from './currentLpObservation.mjs';
import {validateLiquidityCheckpoint} from './liquidityEvidenceCheckpoint.mjs';
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
   'verifiedSoldRaw','totalAcquiredRaw','reconciledRemainingRaw','sellThroughPct'].every(field=>saved[field]===actual[field]);
 }catch{return false;}
}
export function projectCreatorCheckpoint(row,mint){
 if(!row)return {status:'not_started',mint};
 if(row.mint!==mint||!row.state||typeof row.state!=='object')throw Error('CREATOR_CHECKPOINT_MISMATCH');
 const s=row.state,h=s.holdings;
 const creators=[...new Set((Array.isArray(s.originEvidence)?s.originEvidence:[]).map(e=>e?.creator).filter(x=>address.test(x||'')))];
 const creator=creators.length===1?creators[0]:null;
 const holdings=h?.mint===mint&&h?.creator===creator&&h.status==='ONCHAIN_BALANCE_OBSERVED'?{
  creator,supplySharePct:finite(h.supplySharePct)?h.supplySharePct:null,
  observedAt:stamp(h.balanceObservedAt),scoreEligible:false}:null;
 // No verified attribution-complete holdings denominator or prior-launch point
 // producer exists yet. A wallet balance and launch count must not fill those.
 const selling=s.selling,allocation=s.initialAllocationEvidence;
 const windows=Array.isArray(selling?.windows)?selling.windows:[];
 const complete=creatorLedgerConsistent(s,mint,creator)&&s.creatorHistoryComplete===true&&allocation?.status==='INITIAL_ALLOCATION_EVIDENCE_COMPLETE'&&allocation?.coverageComplete===true&&
  /^\d+$/.test(allocation?.initialAttributableRaw||'')&&BigInt(allocation.initialAttributableRaw)>0n&&
  selling?.methodology==='CREATOR_SELLING_V1_1'&&selling.creatorSellingScoreEligible===true&&
  [3600,86400,604800].every(seconds=>windows.filter(w=>w.seconds===seconds).length===1&&
   windows.some(w=>w.seconds===seconds&&w.historyComplete===true&&w.scoreEligible===true&&finite(w.sellThroughPct)&&/^\d+$/.test(w.verifiedSoldRaw||'')&&
    w.sellThroughPct===Number(BigInt(w.verifiedSoldRaw)*1000000n/BigInt(allocation.initialAttributableRaw))/10000));
 return {mint,status:['queued','running','partial','complete','failed'].includes(row.status)?row.status:'unknown',
  stage:['identification','holdings','selling','previous_launches','complete'].includes(row.stage)?row.stage:'unknown',
  updatedAt:stamp(row.updated_at),creator,holdings,
  selling:complete?{historyComplete:true,percentages:[3600,86400,604800].map(seconds=>windows.find(w=>w.seconds===seconds).sellThroughPct)}:null,
  previousLaunchCount:count(s.previousLaunches?.attributedLaunchCount),
  missing:['Verified creator/team holdings attribution','Comparable previous-launch scoring evidence',...(!complete?['Verified initial allocation and complete selling windows']:[])]};
}
export function projectLiquidityCheckpoint(row,mint){
 if(!row)return {status:'not_started',mint};
 const e=row.evidence;
 if(row.mint!==mint||!e||e.mint!==mint||![1,2].includes(e.schemaVersion)||!Array.isArray(e.pools)||!Array.isArray(e.batchErrors))throw Error('LIQUIDITY_CHECKPOINT_UNSUPPORTED');
 if(e.schemaVersion===1&&(e.finalScore!==null||e.verifiedDepth!==false||e.lpSecurityVerified!==false))throw Error('LIQUIDITY_CHECKPOINT_UNSUPPORTED');
 validateLiquidityCheckpoint(e);
 const scoring=e.schemaVersion===2?projectLiquidityScoring(e,mint):null;
 return {mint,schemaVersion:e.schemaVersion,status:['partial','account_checks_completed','complete'].includes(e.status)?e.status:'unknown',
  updatedAt:stamp(row.updated_at),observedAt:stamp(e.observedAt),checkedPoolCount:e.pools.length,
  reportedPoolCount:count(e.providerReportedPools),failedBatchCount:e.batchErrors.length,
  lpObservation:projectCurrentLpObservation(e.currentLpObservation,mint),
  ...(scoring?{scoringEvidence:{...scoring,mint,provenance:scoring.provenance.map(p=>({...p,mint,validated:true,coverageComplete:true}))},finalScore:e.finalScore,verifiedDepth:e.verifiedDepth,lpSecurityVerified:e.lpSecurityVerified}:{}),
  missing:scoring?scoring.assessment.components.filter(c=>c.points===null).map(c=>c.id):['Verified executable depth and market cap','Verified LP withdrawal control','Independent pool concentration','Verified reference sell impact','30-day reserve history']};
}
export async function readDashboardEvidence({mint,url,key,fetchImpl=fetch}={}){
 if(!address.test(mint||''))throw Error('INVALID_MINT');
 if(!/^https:\/\//.test(url||'')||!key)throw Error('EVIDENCE_STORAGE_UNAVAILABLE');
 async function read(table,select,project){
  // Leave 3 seconds within the client's unchanged 12-second response deadline.
  // Race the entire read, including body parsing, even if transport ignores abort.
  const controller=new AbortController();let timer;
  const expired=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('READ_TIMEOUT'));},9000);});
  try{
   return await Promise.race([(async()=>{
   const response=await fetchImpl(url.replace(/\/$/,'')+'/rest/v1/'+table+'?mint=eq.'+encodeURIComponent(mint)+'&select='+select+'&limit=1',{
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
 const [creator,liquidity]=await Promise.all([
  read('creator_intelligence_jobs','mint,status,stage,state,updated_at',projectCreatorCheckpoint),
  read('liquidity_evidence_checkpoints','mint,evidence,updated_at',projectLiquidityCheckpoint)]);
 return {version:'1.1',mint,creator,liquidity};
}
