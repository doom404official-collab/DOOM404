import {createHash} from "node:crypto";
import {validateHistoryCheckpoint,HISTORY_CLASSIFICATION} from "./liquidityHistoricalDecoder.mjs";
export function verifyHistoricalReplaySource(plan,checkpoint,pool){
 validateHistoryCheckpoint(checkpoint,pool);
 if(!plan||plan.pool!==pool||plan.kind!=="HISTORICAL_DECODER_REPLAY_PLAN"||plan.originalClassification!==HISTORY_CLASSIFICATION)throw Error("REPLAY_SOURCE_MISMATCH");
 const digest=createHash("sha256").update(JSON.stringify({pool,seen:checkpoint.seen,events:checkpoint.events,updatedAt:checkpoint.updatedAt||null})).digest("hex");
 if(digest!==plan.sourceDigest)throw Error("REPLAY_SOURCE_DIGEST_MISMATCH");
 if(plan.signaturesToReplay.some(s=>!checkpoint.seen.includes(s)))throw Error("REPLAY_SIGNATURE_NOT_IN_SOURCE");
 return true;
}
