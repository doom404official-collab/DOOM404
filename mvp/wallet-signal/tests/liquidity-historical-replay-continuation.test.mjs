import test from "node:test";
import assert from "node:assert/strict";
import {selectReplayRemainder} from "../lib/liquidityHistoricalReplayContinuation.mjs";
const plan={pool:"pool",sourceDigest:"digest",signaturesToReplay:["a","b","c"]};
const previous={kind:"HISTORICAL_DECODER_REPLAY_EVIDENCE",pool:"pool",sourceDigest:"digest",classification:"AMOUNT_RECONCILED_AUTHORIZATION_PENDING",authorizationVerified:false,finalScore:null,transactions:[{signature:"a"},{signature:"b"}]};
test("continuation excludes previously completed signatures",()=>assert.deepEqual(selectReplayRemainder(plan,previous),["c"]));
test("continuation rejects unrelated evidence",()=>{
 assert.throws(()=>selectReplayRemainder(plan,{...previous,sourceDigest:"different"}));
 assert.deepEqual(selectReplayRemainder(plan,{...previous,transactions:[{signature:"other-segment"}]}),["a","b","c"]);
 assert.throws(()=>selectReplayRemainder(plan,{...previous,authorizationVerified:true}));
});

test("continuation from previous segment excludes only overlapping signatures",()=>{
 const previousSegment={...previous,transactions:[{signature:"outside"},{signature:"a"}]};
 assert.deepEqual(selectReplayRemainder(plan,previousSegment),["b","c"]);
});
