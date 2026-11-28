import {createScanReadScheduler} from './scanReadScheduler.mjs';
import {practicalAssessmentV2} from './practicalScoringV2.mjs';
import {traderFindings,findingCounts} from './traderRiskExplanations.mjs';
const abortError=()=>Object.assign(Error('Inspection cancelled'),{name:'AbortError'});
/** One admitted, mint-scoped pipeline. This does not change provider budgets or
 * score incomplete evidence. Initial/current evidence is never behind history. */
export async function runStagedTokenScan({mint,read,signal:parentSignal,onUpdate=()=>{},onInitial=async()=>{},now=()=>performance.now(),wait,initialBudgetMs=9000,completionBudgetMs=60000}={}){
 if(typeof read!=='function'||typeof mint!=='string'||!mint)throw Error('INVALID_STAGED_SCAN');
 const budgetController=new AbortController(),signal=parentSignal?AbortSignal.any([parentSignal,budgetController.signal]):budgetController.signal;
 let deadlineTimer;const deadline=new Promise((_,reject)=>{deadlineTimer=setTimeout(()=>{budgetController.abort();reject(Object.assign(abortError(),{code:'SCAN_COMPLETION_DEADLINE'}));},completionBudgetMs);});
 // Every transport, including non-cooperative injected adapters, has a finite race.
 const scheduleRead=createScanReadScheduler({read,signal});
 const boundedRead=path=>Promise.race([scheduleRead(path),deadline]);
 const started=now(),stages={},stageReasons={},snapshot={result:null,extensions:null,concentration:null,creatorEvidence:null,liquidity:null,currentLiquidity:null,currentCreator:null,workerEvidence:null,historicalHolders:null,verifiedHolderEnvelope:null,holderEvidenceState:'unknown'},timing={acknowledgementMs:0,stages:[]};
 const timers=new Set();
 const pause=wait||((ms)=>new Promise((resolve,reject)=>{const abort=()=>{clearTimeout(t);timers.delete(t);signal?.removeEventListener('abort',abort);reject(abortError());};const t=setTimeout(()=>{timers.delete(t);signal?.removeEventListener('abort',abort);resolve();},ms);timers.add(t);if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});}));
 const check=()=>{if(signal?.aborted)throw abortError();};
 let published=false,initialResolve,closed=false,revision=0;
 const initialReady=new Promise(resolve=>{initialResolve=resolve;});
 // Consumers render these statuses separately from evidence coverage/risk.
 const progress=()=>({stage:closed?'bounded_complete':published?'deep_in_progress':'initial_in_progress',pending:Object.keys(stages).filter(k=>stages[k]==='running'),unavailable:Object.keys(stages).filter(k=>stages[k]==='unavailable'),completed:Object.keys(stages).filter(k=>stages[k]==='completed'),failures:Object.entries(stageReasons).map(([stage,detail])=>({stage,...detail})),historyComplete:false});
 const readiness=()=>{
  if(!snapshot.result)return {initial:false,decision:false};
  let critical=false,depth=false,holders=false;
  try{const assessment=practicalAssessmentV2({...snapshot,reportedLiquidity:snapshot.liquidity});critical=findingCounts(traderFindings(assessment,'overall')).critical>0;holders=assessment.scores.holder_intelligence.coveragePct>0&&Number.isFinite(assessment.scores.holder_intelligence.metrics.top20Pct);depth=assessment.scores.liquidity_quality_safety.components.some(c=>c.id==='exit_cost_and_depth'&&c.complete===true)&&assessment.scores.token_security.coveragePct===100;}catch{}
  return {initial:critical||holders,decision:critical||holders&&depth};
 };
 const publish=()=>{
  if(signal?.aborted||closed)return;
  const ready=readiness();
  if(ready.decision&&timing.decisionReadyMs==null)timing.decisionReadyMs=Math.round(now()-started);
  onUpdate({...snapshot,evidenceRevision:++revision,inspectionTiming:{...timing,stages:[...timing.stages]},investigationProgress:{...progress(),decisionReady:ready.decision}});
  if(ready.initial)initialResolve();
 };
 async function task(name,operation,apply){
  check();const start=now();stages[name]='running';publish();
  try{const value=await operation();check();apply?.(value);stages[name]='completed';return value;}
  catch(e){stages[name]='unavailable';stageReasons[name]={reason:/^[A-Za-z0-9_ -]{1,100}$/.test(e.code||'')?e.code:e.name==='AbortError'?'bounded_deadline_or_cancelled':'source_unavailable',status:Number.isSafeInteger(e.status)?e.status:null};if(e.name==='AbortError')throw e;return null;}
  finally{timing.stages.push({name,startedMs:Math.round(start-started),durationMs:Math.round(now()-start),status:stages[name]});publish();}
 }
 const get=(path)=>boundedRead(path+(path.includes('?')?'&':'?')+'mint='+encodeURIComponent(mint));
 // At most six admitted source reads run concurrently. Token-2022 resolution
 // waits for mint; pool calculation waits only for market discovery.
 const mintTask=task('mint_security',()=>get('/api/token-current'),value=>{snapshot.result=value;snapshot.extensions=value.currentExtensions||null;timing.firstEvidenceMs=Math.round(now()-started);});
 const holderTask=task('holder_classification',()=>get('/api/token-concentration'),value=>{snapshot.concentration=value;});
 const creatorTask=task('cached_creator_attribution',()=>get('/api/creator-evidence'),value=>{snapshot.creatorEvidence=value;});
 const dashboardTask=task('retained_evidence',()=>get('/api/scoring-evidence'),value=>{snapshot.workerEvidence=value;});
 const currentCreatorTask=task('current_creator',()=>get('/api/current-creator'),value=>{snapshot.currentCreator=value?.mint===mint?value:null;timing.creatorMs=Math.round(now()-started);});
 const marketTask=task('market_pool_discovery',()=>get('/api/token-liquidity'),value=>{snapshot.liquidity=value;});
 const liquidityTask=task('reference_sales',async()=>{
  const market=await marketTask;check();const pools=(market?.pools||[]).slice(0,2).map(p=>p.pairAddress).filter(Boolean);
  if(!pools.length)return null;
  return boundedRead('/api/current-liquidity?mint='+encodeURIComponent(mint)+'&pool='+encodeURIComponent(pools[0])+'&alternates='+encodeURIComponent(pools.slice(1).join(',')));
 },value=>{snapshot.currentLiquidity=value?.observation||null;if(!snapshot.currentLiquidity){const reason=[value?.reason,value?.status].find(x=>typeof x==='string'&&/^[A-Za-z0-9_ -]{1,100}$/.test(x));stageReasons.reference_sales={reason:reason||'no_supported_pool_calculation',status:null};}timing.liquidityMs=Math.round(now()-started);});
 const extensionTask=task('extension_epoch_resolution',async()=>{
  const result=await mintTask;if(!result)return null;
  const fee=result.currentExtensions?.transferFee;
  if(result.tokenProgram!=='spl-token-2022'||result.currentExtensions&&!(fee?.status==='observed'&&(!fee.configAuthorityReported||fee.configAuthority===null&&!fee.effectiveFee)))return null;
  return get('/api/token-extensions');
 },value=>{if(value)snapshot.extensions=value;});
 const initialTasks=[mintTask,holderTask,creatorTask,dashboardTask,currentCreatorTask,marketTask,liquidityTask,extensionTask];
 const allInitial=Promise.allSettled(initialTasks).then(()=>{timing.initialSourcesMs=Math.round(now()-started);});
 // Drain failures immediately; initial publication still requires verified mint.
 void allInitial.catch(()=>{});
 try{
  await mintTask;check();if(!snapshot.result)throw Error('CURRENT_MINT_UNAVAILABLE');
  await Promise.race([initialReady,allInitial,pause(Math.max(0,initialBudgetMs-(now()-started)))]);check();
  published=true;timing.initialReportMs=Math.round(now()-started);
  await Promise.race([onInitial({...snapshot,evidenceRevision:++revision,inspectionTiming:{...timing,stages:[...timing.stages]},investigationProgress:{...progress(),decisionReady:readiness().decision}}),deadline]);
  publish();
  const deep=task('bounded_history',async()=>{
   let investigation=await get('/api/token-investigation?run=1');
   while(investigation?.status==='assessment_in_progress'&&now()-started<completionBudgetMs-5000){await pause(5000);check();investigation=await get('/api/token-investigation');}
   return investigation;
  },value=>{snapshot.investigationState=value;});
  // Retained holder views are read-only and independent of the deep worker.
  const holderViews=Promise.allSettled([
   task('retained_holder_relationships',()=>get('/api/holder-scan-status'),value=>{snapshot.historicalHolders=value?.scan?.mint===mint?value.scan:null;}),
   task('retained_holder_assessment',()=>get('/api/holder-assessment'),value=>{snapshot.verifiedHolderEnvelope=value?.assessment?value:null;snapshot.holderEvidenceState=value?.assessment?'ready':'unknown';}),
   task('extended_holder_sample',()=>get('/api/token-concentration?extend=1'),value=>{if(value?.sampledWalletObservation)snapshot.concentration=value;})
  ]);
  await Promise.allSettled([allInitial,deep,holderViews]);check();
  // Exactly one final read-back after worker completion; no new worker on reload.
  if(snapshot.investigationState?.status==='investigation_completed')await Promise.allSettled([
   snapshot.currentCreator?.status==='verified_current_wallet'&&snapshot.currentCreator.creator===(snapshot.investigationState.creator?.creator||snapshot.investigationState.creator?.attribution?.creator)?Promise.resolve():task('final_creator_evidence',()=>get('/api/current-creator'),value=>{if(value?.version===2)snapshot.currentCreator=value;}),
   task('final_retained_evidence',()=>get('/api/scoring-evidence?phase=bounded_final'),value=>{snapshot.workerEvidence=value;})
  ]);
  check();timing.boundedReportMs=Math.round(now()-started);closed=true;
  const final={...snapshot,evidenceRevision:++revision,inspectionTiming:{...timing,stages:[...timing.stages]},investigationProgress:{...progress(),...(snapshot.investigationState?.status==='assessment_in_progress'?{stage:'bounded_stopped',reason:'worker_lease_still_running'}:{}),decisionReady:readiness().decision}};
  onUpdate(final);return final;
 }catch(e){throw e;}
 finally{closed=true;clearTimeout(deadlineTimer);for(const timer of timers)clearTimeout(timer);budgetController.abort();}
}
