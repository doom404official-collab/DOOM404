import {createHash} from "node:crypto";
import {HISTORY_CLASSIFICATION,validateHistoryCheckpoint} from "./liquidityHistoricalDecoder.mjs";
export function buildHistoricalReplayPlan(original,{pool,maxSignatures=500}={}){
 validateHistoryCheckpoint(original,pool);
 if(!Number.isSafeInteger(maxSignatures)||maxSignatures<1||maxSignatures>5000)throw Error("INVALID_REPLAY_LIMIT");
 const signatures=[...new Set(original.seen)];
 const pending=(original.pendingSignatures||[]).filter(s=>!signatures.includes(s));
 const selected=signatures.slice(0,maxSignatures);
 const digest=createHash("sha256").update(JSON.stringify({pool,seen:original.seen,events:original.events,updatedAt:original.updatedAt||null})).digest("hex");
 return {schemaVersion:1,kind:"HISTORICAL_DECODER_REPLAY_PLAN",pool,sourceDigest:digest,originalClassification:HISTORY_CLASSIFICATION,originalSeenCount:signatures.length,signaturesToReplay:selected,remainingReplayCount:signatures.length-selected.length,existingPendingSignatures:pending,originalEventCount:original.events.length,requiresExplicitReplay:true,authorizationVerified:false,finalScore:null,originalCheckpointPreserved:true};
}
