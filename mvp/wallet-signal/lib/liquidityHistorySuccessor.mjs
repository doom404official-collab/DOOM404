import {assessAutomaticHistoryCheckpoint} from "./liquidityAutomaticHistoryGate.mjs";

/** Canonical successor validation shared by the CLI and offline evidence consumers. */
export function assessHistorySuccessor(prior,next,pool){
 const before=assessAutomaticHistoryCheckpoint(prior,pool);
 if(before.action!=="CONTINUE_BOUNDED")throw Error("PRIOR_CHECKPOINT_NOT_CONTINUABLE");
 const after=assessAutomaticHistoryCheckpoint(next,pool);
 if(next.seen.length<prior.seen.length||prior.seen.some(s=>!next.seen.includes(s)))throw Error("HISTORY_SIGNATURE_REGRESSION");
 if(next.reconciliation?.sourceDigest!==prior.reconciliation?.sourceDigest)throw Error("HISTORY_RECONCILIATION_DRIFT");
 if((next.requestCount||0)<(prior.requestCount||0))throw Error("HISTORY_REQUEST_REGRESSION");
 if(next.before===prior.before&&next.seen.length===prior.seen.length&&after.action==="CONTINUE_BOUNDED")throw Error("HISTORY_NO_PROGRESS_MANUAL_REVIEW");
 return after;
}
