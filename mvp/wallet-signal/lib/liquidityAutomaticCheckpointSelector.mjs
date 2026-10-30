import {isDeepStrictEqual} from 'node:util';
import {assertRetainedHistory} from './liquidityHistorySuccessor.mjs';
import {assessAutomaticHistoryCheckpoint} from "./liquidityAutomaticHistoryGate.mjs";
export function selectLiquidityContinuationCheckpoint(candidates,pool){
 if(!Array.isArray(candidates)||!candidates.length)throw Error("NO_CHECKPOINT_CANDIDATES");
 const valid=[];
 const rejected=[];
 const observed=new Map();
 for(const item of candidates){
  if(!Number.isSafeInteger(item?.runId)||item.runId<=0)continue;
  if(observed.has(item.runId)){
   if(!isDeepStrictEqual(observed.get(item.runId),item))throw Error('CHECKPOINT_RUN_ID_CONFLICT');
   continue; // Identical observations of one run are not separate history steps.
  }
  observed.set(item.runId,item);
  try{
   if(!item.state)throw Error("CHECKPOINT_STATE_MISSING");
   if(item.state.complete!==true && item.state.historyCoverageVerified!==false)throw Error('UNVERIFIED_HISTORY_COVERAGE_CLAIM');
   const decision=assessAutomaticHistoryCheckpoint(item.state,pool);
   if(decision.action==='PAUSE_UNRESOLVED_SIGNATURES')throw Error('UNRESOLVED_PARTIAL_CHECKPOINT_NOT_SELECTABLE');
   valid.push({...item,decision});
  }catch(error){rejected.push({runId:item.runId,reason:String(error.message)});continue;}
 }
 if(!valid.length)throw Error("NO_VALID_RECONCILED_CHECKPOINT");
 valid.sort((a,b)=>b.runId-a.runId);
 const latest=valid[0];
 if(rejected.some(item=>item.runId>latest.runId))throw Error("NEWER_CHECKPOINT_INVALID_MANUAL_REVIEW_REQUIRED");
 for(let i=0;i<valid.length-1;i++){
  const current=valid[i].state;
  const previous=valid[i+1].state;
  if(current.seen.length<previous.seen.length||previous.seen.some(s=>!current.seen.includes(s)))throw Error("CHECKPOINT_LINEAGE_REGRESSION");
  if((current.requestCount||0)<(previous.requestCount||0))throw Error("CHECKPOINT_REQUEST_COUNT_REGRESSION");
  assertRetainedHistory(previous,current);
  if(current.reconciliation?.sourceDigest!==previous.reconciliation?.sourceDigest)throw Error("CHECKPOINT_RECONCILIATION_SOURCE_DRIFT");
  if(current.before===null&&!current.complete)throw Error("CHECKPOINT_CURSOR_MISSING");
 }
 return {runId:latest.runId,state:latest.state,action:latest.decision.action};
}
