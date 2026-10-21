import {isDeepStrictEqual} from "node:util";
import {validateHistoryCheckpoint} from "./liquidityHistoricalDecoder.mjs";
import {summarizeLiquidityFailure} from "./liquidityFailureDiagnostic.mjs";
const fields=new Set('schemaVersion pool before seen events pages complete classification pendingSignatures unresolvedReasons requestCount errors updatedAt finalScore withdrawalVerified authorizationVerified historyCoverageVerified pendingSignatureCount signaturesAttemptedThisRun stopReason reconciliation'.split(' '));
const provenanceFields=new Set('reconciliationStatus originalPendingSignatureCount originalStopReason sourceDigest replayDigest originalSeen recoveredPending verifiedDistinct candidateCount historyExhausted'.split(' '));
const signature=x=>typeof x==='string'&&/^[1-9A-HJ-NP-Za-km-z]{32,88}$/.test(x);
const integer=x=>Number.isSafeInteger(x)&&x>=0;
const reasons=new Set(['REQUEST_BUDGET_EXHAUSTED','RPC_TRANSACTION_UNAVAILABLE','TRANSACTION_SLOT_MISMATCH']);
function checkShape(state,pool){
 validateHistoryCheckpoint(state,pool);
 if(Object.keys(state).some(k=>!fields.has(k)))throw Error('PARTIAL_RECOVERY_UNKNOWN_FIELD');
 if(state.complete!==false||state.historyCoverageVerified!==false||state.authorizationVerified!==false||state.withdrawalVerified!==false||state.finalScore!==null)throw Error('UNSAFE_PARTIAL_RECOVERY');
 if(!signature(state.pool)||!signature(state.before)||!state.seen.every(signature)||!Array.isArray(state.pendingSignatures)||!state.pendingSignatures.every(signature)||new Set(state.pendingSignatures).size!==state.pendingSignatures.length)throw Error('PARTIAL_RECOVERY_IDENTIFIERS_INVALID');
 if(state.pendingSignatureCount!==state.pendingSignatures.length||!state.unresolvedReasons||typeof state.unresolvedReasons!=='object'||Array.isArray(state.unresolvedReasons)||Object.keys(state.unresolvedReasons).length!==state.pendingSignatures.length||state.pendingSignatures.some(s=>!Object.hasOwn(state.unresolvedReasons,s)||!reasons.has(state.unresolvedReasons[s])))throw Error('PARTIAL_RECOVERY_PENDING_INVALID');
 if(!integer(state.requestCount)||!integer(state.pages)||('signaturesAttemptedThisRun' in state&&!integer(state.signaturesAttemptedThisRun)))throw Error('PARTIAL_RECOVERY_COUNTER_INVALID');
 if(!Array.isArray(state.errors)||state.errors.some(e=>!e||typeof e!=='object'||Array.isArray(e)))throw Error('PARTIAL_RECOVERY_ERRORS_INVALID');
 if(!['CHECKPOINTED','REQUEST_BUDGET_EXHAUSTED','RETRIEVAL_INCOMPLETE'].includes(state.stopReason))throw Error('PARTIAL_RECOVERY_STOP_INVALID');
 const r=state.reconciliation;
 if(!r||Object.keys(r).some(k=>!provenanceFields.has(k))||r.reconciliationStatus!=='PENDING_SIGNATURES_RECONCILED_HISTORY_UNVERIFIED'||!['RETRIEVAL_INCOMPLETE','REQUEST_BUDGET_EXHAUSTED','CHECKPOINTED'].includes(r.originalStopReason)||!['sourceDigest','replayDigest'].every(k=>typeof r[k]==='string'&&/^[a-f0-9]{64}$/.test(r[k]))||!['originalPendingSignatureCount','originalSeen','recoveredPending','verifiedDistinct','candidateCount'].every(k=>integer(r[k]))||r.historyExhausted!==false)throw Error('PARTIAL_RECOVERY_PROVENANCE_INVALID');
 if('updatedAt' in state&&(typeof state.updatedAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(state.updatedAt)||!Number.isFinite(Date.parse(state.updatedAt))))throw Error('PARTIAL_RECOVERY_TIMESTAMP_INVALID');
}
export function validateLiquidityPartialRecovery(prior,next,pool){
 checkShape(prior,pool);checkShape(next,pool);
 if(!isDeepStrictEqual(prior.reconciliation,next.reconciliation))throw Error('PARTIAL_RECOVERY_SOURCE_DRIFT');
 if(prior.events.some(e=>!next.events.some(n=>isDeepStrictEqual(e,n))))throw Error('PARTIAL_RECOVERY_EVENT_REGRESSION');
 // No safe raw-instruction sanitizer contract yet. Do not silently discard candidate evidence.
 if(prior.events.length||next.events.length)throw Error('PARTIAL_RECOVERY_EVENT_SCHEMA_UNSUPPORTED');
 if(next.seen.length<prior.seen.length||prior.seen.some(s=>!next.seen.includes(s)))throw Error('PARTIAL_RECOVERY_SIGNATURE_REGRESSION');
 // Conservatively reject even legitimate page advancement until page provenance is available.
 if(next.before!==prior.before||next.pages!==prior.pages)throw Error('PARTIAL_RECOVERY_CURSOR_ADVANCED');
 if(next.requestCount<prior.requestCount)throw Error('PARTIAL_RECOVERY_REQUEST_REGRESSION');
 if(!next.pendingSignatures.length||prior.pendingSignatures.some(s=>!next.pendingSignatures.includes(s)&&!next.seen.includes(s)))throw Error('PARTIAL_RECOVERY_PENDING_INVALID');
 return {status:'PARTIAL_RECOVERY_VALIDATED',completed:next.seen.length,newlyCompleted:next.seen.length-prior.seen.length,pending:next.pendingSignatures.length,cursorPreserved:true,classification:next.classification,score:null};
}
export function prepareLiquidityPartialRecovery(prior,next,pool){
 const summary=validateLiquidityPartialRecovery(prior,next,pool);
 // Shape-checked state only; free-form provider messages never leave the process.
 const state=structuredClone(next);
 state.errors=summarizeLiquidityFailure(JSON.stringify(next)).errors;
 return {summary,state};
}
