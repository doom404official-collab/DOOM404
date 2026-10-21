import {validateHistoryCheckpoint} from "../lib/liquidityHistoricalDecoder.mjs";
export function validateLiquidityPartialRecovery(prior,next,pool){
 validateHistoryCheckpoint(prior,pool);validateHistoryCheckpoint(next,pool);
 if(prior.complete||next.complete||next.historyCoverageVerified!==false||next.authorizationVerified!==false||next.withdrawalVerified!==false||next.finalScore!==null)throw Error("UNSAFE_PARTIAL_RECOVERY");
 if(prior.reconciliation?.sourceDigest!==next.reconciliation?.sourceDigest)throw Error("PARTIAL_RECOVERY_SOURCE_DRIFT");
 if(next.seen.length<prior.seen.length||prior.seen.some(s=>!next.seen.includes(s)))throw Error("PARTIAL_RECOVERY_SIGNATURE_REGRESSION");
 if(next.before!==prior.before)throw Error("PARTIAL_RECOVERY_CURSOR_ADVANCED");
 if((next.requestCount||0)<(prior.requestCount||0))throw Error("PARTIAL_RECOVERY_REQUEST_REGRESSION");
 if(!Array.isArray(next.pendingSignatures)||next.pendingSignatures.length<1||next.pendingSignatures.some(s=>next.seen.includes(s)))throw Error("PARTIAL_RECOVERY_PENDING_INVALID");
 if(next.events.some(e=>e.authorizationVerified===true||e.classification!=="UNVERIFIED_CANDIDATE"))throw Error("PARTIAL_RECOVERY_EVENT_PROMOTION");
 return {status:"PARTIAL_RECOVERY_VALIDATED",completed:next.seen.length,newlyCompleted:next.seen.length-prior.seen.length,pending:next.pendingSignatures.length,cursorPreserved:true,classification:next.classification,score:null};
}
