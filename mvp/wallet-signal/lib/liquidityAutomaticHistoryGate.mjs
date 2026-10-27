import {validateHistoryCheckpoint,HISTORY_CLASSIFICATION} from "./liquidityHistoricalDecoder.mjs";
export function assessAutomaticHistoryCheckpoint(state,pool){
 validateHistoryCheckpoint(state,pool);
 for(const field of ['pages','requestCount'])if(state[field]!==undefined&&(!Number.isSafeInteger(state[field])||state[field]<0))throw Error('INVALID_HISTORY_COUNTER');
 if(state.authorizationVerified!==false||state.finalScore!==null||state.withdrawalVerified!==false)throw Error("UNSAFE_AUTOMATIC_HISTORY_STATE");
 if(state.complete===true){
  if(state.historyCoverageVerified!==true||state.pendingSignatures?.length)throw Error("UNVERIFIED_HISTORY_EXHAUSTION");
  return {action:"STOP_HISTORY_EXHAUSTED",classification:HISTORY_CLASSIFICATION};
 }
 if(state.reconciliation?.verifiedDistinct!==34||state.reconciliation?.recoveredPending!==2||!state.before)throw Error("RECONCILED_HISTORY_SEED_REQUIRED");
 if(state.pendingSignatures?.length) return {action:"PAUSE_UNRESOLVED_SIGNATURES",classification:HISTORY_CLASSIFICATION};
 if(state.stopReason==="RETRIEVAL_INCOMPLETE"||state.errors?.some(e=>e.stage==="slot_mismatch"||e.stage==="retry_guard"))return {action:"PAUSE_EVIDENCE_ERROR",classification:HISTORY_CLASSIFICATION};
 return {action:"CONTINUE_BOUNDED",classification:HISTORY_CLASSIFICATION};
}
