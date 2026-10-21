import {createHash} from "node:crypto";
import {validateHistoryCheckpoint,HISTORY_CLASSIFICATION} from "./liquidityHistoricalDecoder.mjs";
const hash=x=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
export function reconcileLiquidityHistory(original,replays,recovery,pool){
 validateHistoryCheckpoint(original,pool);
 if(!Array.isArray(replays)||replays.length!==4)throw Error("REQUIRE_FOUR_REPLAY_ARTIFACTS");
 const expectedReplayDigest=hash({pool,seen:original.seen,events:original.events,updatedAt:original.updatedAt||null});
 const expectedRecoveryDigest=hash(original);
 const seen=new Set(),events=[];
 for(const artifact of replays){
  if(artifact.kind!=="HISTORICAL_DECODER_REPLAY_EVIDENCE"||artifact.pool!==pool||artifact.sourceDigest!==expectedReplayDigest||artifact.classification!==HISTORY_CLASSIFICATION||artifact.authorizationVerified!==false||artifact.finalScore!==null||!Array.isArray(artifact.transactions)||!Array.isArray(artifact.unresolved))throw Error("INVALID_REPLAY_ARTIFACT");
  for(const tx of artifact.transactions){
   if(!original.seen.includes(tx.signature)||seen.has(tx.signature))throw Error("REPLAY_SIGNATURE_MISMATCH_OR_DUPLICATE");
   if(tx.execution!=="EXECUTION_SUCCEEDED_AUTHORIZATION_UNVERIFIED")throw Error("UNVERIFIED_REPLAY_EXECUTION");
   seen.add(tx.signature);
   events.push(...(tx.candidates||[]));
  }
 }
 if(seen.size!==original.seen.length)throw Error("INCOMPLETE_REPLAY_COVERAGE");
 if(!recovery||recovery.kind!=="LIQUIDITY_PENDING_SIGNATURE_RECOVERY"||recovery.pool!==pool||recovery.sourceDigest!==expectedRecoveryDigest||recovery.classification!==HISTORY_CLASSIFICATION||recovery.authorizationVerified!==false||recovery.finalScore!==null||!Array.isArray(recovery.transactions)||recovery.unresolved?.length)throw Error("INVALID_PENDING_RECOVERY");
 const pending=new Set(original.pendingSignatures||[]);
 const recovered=new Set();
 for(const tx of recovery.transactions){
  if(!pending.has(tx.signature)||seen.has(tx.signature)||recovered.has(tx.signature))throw Error("PENDING_SIGNATURE_MISMATCH_OR_DUPLICATE");
  if(tx.execution!=="EXECUTION_SUCCEEDED_AUTHORIZATION_UNVERIFIED")throw Error("UNVERIFIED_PENDING_EXECUTION");
  recovered.add(tx.signature);events.push(...(tx.candidates||[]));
 }
 if(recovered.size!==pending.size)throw Error("INCOMPLETE_PENDING_RECOVERY");
 if(events.some(e=>e.authorizationVerified===true||e.classification!=="UNVERIFIED_CANDIDATE"))throw Error("UNSAFE_EVENT_PROMOTION");
 const result={...original,seen:[...original.seen,...recovery.transactions.map(t=>t.signature)],pendingSignatures:[],unresolvedReasons:{},events:[...original.events,...events],complete:false,historyCoverageVerified:false,authorizationVerified:false,withdrawalVerified:false,finalScore:null,classification:HISTORY_CLASSIFICATION,reconciliation:{sourceDigest:expectedRecoveryDigest,replayDigest:expectedReplayDigest,originalSeen:original.seen.length,recoveredPending:recovered.size,verifiedDistinct:seen.size+recovered.size,candidateCount:events.length,historyExhausted:false}};
 validateHistoryCheckpoint(result,pool);
 return result;
}
