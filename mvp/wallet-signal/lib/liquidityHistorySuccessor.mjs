import {isDeepStrictEqual} from 'node:util';
import {assessAutomaticHistoryCheckpoint} from "./liquidityAutomaticHistoryGate.mjs";

/** Canonical successor validation shared by the CLI and offline evidence consumers. */
export function assessHistorySuccessor(prior,next,pool){
 const before=assessAutomaticHistoryCheckpoint(prior,pool);
 if(before.action!=="CONTINUE_BOUNDED")throw Error("PRIOR_CHECKPOINT_NOT_CONTINUABLE");
 const after=assessAutomaticHistoryCheckpoint(next,pool);
 if(next.seen.length<prior.seen.length||prior.seen.some(s=>!next.seen.includes(s)))throw Error("HISTORY_SIGNATURE_REGRESSION");
 if(next.reconciliation?.sourceDigest!==prior.reconciliation?.sourceDigest)throw Error("HISTORY_RECONCILIATION_DRIFT");
 if((next.requestCount||0)<(prior.requestCount||0))throw Error("HISTORY_REQUEST_REGRESSION");
 assertRetainedHistory(prior,next);
 if(next.before===prior.before&&next.seen.length===prior.seen.length&&after.action==="CONTINUE_BOUNDED")throw Error("HISTORY_NO_PROGRESS_MANUAL_REVIEW");
 return after;
}

/** Append-only retained evidence; missing legacy errors means no prior errors. */
export function assertRetainedHistory(prior,next){
 for(const field of ['pages','requestCount']){
  assertHistoryCounter(prior,field);assertHistoryCounter(next,field);
  if(prior[field]!==undefined&&(next[field]===undefined||next[field]<prior[field]))throw Error('HISTORY_COUNTER_REGRESSION');
 }
 // Cursors are opaque signatures, not sortable numbers. A changed cursor must
 // be newly processed; moving back into the retained prefix is regression.
 if(next.before!==prior.before){
  if(typeof next.before!=='string'||prior.seen.includes(next.before)||!next.seen.slice(prior.seen.length).includes(next.before))throw Error('HISTORY_CURSOR_REGRESSION');
  if(prior.pages!==undefined&&next.pages!==undefined&&next.pages<=prior.pages)throw Error('HISTORY_PAGE_CURSOR_MISMATCH');
 }else if(prior.pages!==undefined&&next.pages!==undefined&&next.pages!==prior.pages)throw Error('HISTORY_PAGE_CURSOR_MISMATCH');
 if(prior.seen.some((signature,index)=>next.seen[index]!==signature))throw Error('HISTORY_SIGNATURE_ORDER_DRIFT');
 for(const field of ['events','errors']){
  const before=prior[field]===undefined?[]:prior[field],after=next[field]===undefined?[]:next[field];
  if(!Array.isArray(before)||!Array.isArray(after)||after.length<before.length||before.some((entry,index)=>!isDeepStrictEqual(entry,after[index])))throw Error('HISTORY_RETAINED_EVIDENCE_DRIFT');
 }
}

function assertHistoryCounter(state,field){
 if(state[field]!==undefined&&(!Number.isSafeInteger(state[field])||state[field]<0))throw Error('INVALID_HISTORY_COUNTER');
}
