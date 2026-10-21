import {assessAutomaticHistoryCheckpoint} from "./liquidityAutomaticHistoryGate.mjs";
export function selectLiquidityContinuationCheckpoint(candidates,pool){
 if(!Array.isArray(candidates)||!candidates.length)throw Error("NO_CHECKPOINT_CANDIDATES");
 const valid=[];
 const rejected=[];
 for(const item of candidates){
  if(!Number.isSafeInteger(item?.runId)||item.runId<=0||!item?.state)continue;
  try{
   const decision=assessAutomaticHistoryCheckpoint(item.state,pool);
   valid.push({...item,decision});
  }catch(error){rejected.push({runId:item.runId,reason:String(error.message)});continue;}
 }
 if(!valid.length)throw Error("NO_VALID_RECONCILED_CHECKPOINT");
 valid.sort((a,b)=>b.runId-a.runId);
 const latest=valid[0];
 if(rejected.some(item=>item.runId>latest.runId))throw Error("NEWER_CHECKPOINT_INVALID_MANUAL_REVIEW_REQUIRED");
 if(valid.length>1){
  const previous=valid[1].state;
  const current=latest.state;
  if(current.seen.length<previous.seen.length||previous.seen.some(s=>!current.seen.includes(s)))throw Error("CHECKPOINT_LINEAGE_REGRESSION");
  if(current.requestCount<previous.requestCount)throw Error("CHECKPOINT_REQUEST_COUNT_REGRESSION");
 }
 return {runId:latest.runId,state:latest.state,action:latest.decision.action};
}
