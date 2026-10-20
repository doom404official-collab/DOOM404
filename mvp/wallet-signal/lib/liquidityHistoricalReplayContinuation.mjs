export function selectReplayRemainder(plan,previous){
 if(!plan||!previous||plan.pool!==previous.pool||plan.sourceDigest!==previous.sourceDigest||previous.kind!=="HISTORICAL_DECODER_REPLAY_EVIDENCE")throw Error("REPLAY_CONTINUATION_SOURCE_MISMATCH");
 if(previous.classification!=="AMOUNT_RECONCILED_AUTHORIZATION_PENDING"||previous.authorizationVerified!==false||previous.finalScore!==null)throw Error("UNSAFE_REPLAY_CONTINUATION");
 const completed=new Set((previous.transactions||[]).map(t=>t.signature));
 const eligible=new Set(plan.signaturesToReplay);
 // Completed signatures from another segment of the same checkpoint are valid.
 // Only intersecting signatures are excluded from this segment.
 return plan.signaturesToReplay.filter(s=>!completed.has(s));
}
