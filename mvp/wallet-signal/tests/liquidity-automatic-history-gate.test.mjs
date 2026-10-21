import test from "node:test";
import assert from "node:assert/strict";
import {assessAutomaticHistoryCheckpoint} from "../lib/liquidityAutomaticHistoryGate.mjs";
const base={schemaVersion:1,pool:"pool",before:"cursor",seen:["a"],events:[],pendingSignatures:[],classification:"AMOUNT_RECONCILED_AUTHORIZATION_PENDING",complete:false,historyCoverageVerified:false,authorizationVerified:false,withdrawalVerified:false,finalScore:null,reconciliation:{verifiedDistinct:34,recoveredPending:2}};
test("shadow gate permits only bounded incomplete continuation",()=>assert.equal(assessAutomaticHistoryCheckpoint(base,"pool").action,"CONTINUE_BOUNDED"));
test("shadow gate pauses pending or unsafe evidence",()=>{
 assert.equal(assessAutomaticHistoryCheckpoint({...base,pendingSignatures:["b"]},"pool").action,"PAUSE_UNRESOLVED_SIGNATURES");
 assert.throws(()=>assessAutomaticHistoryCheckpoint({...base,finalScore:10},"pool"),/UNSAFE/);
 assert.throws(()=>assessAutomaticHistoryCheckpoint({...base,reconciliation:undefined},"pool"),/RECONCILED/);
});
test("verified exhaustion stops, incomplete exhaustion rejects",()=>{
 assert.equal(assessAutomaticHistoryCheckpoint({...base,complete:true,historyCoverageVerified:true},"pool").action,"STOP_HISTORY_EXHAUSTED");
 assert.throws(()=>assessAutomaticHistoryCheckpoint({...base,complete:true},"pool"),/UNVERIFIED/);
});
