import test from "node:test";
import assert from "node:assert/strict";
import {selectLiquidityContinuationCheckpoint} from "../lib/liquidityAutomaticCheckpointSelector.mjs";
const state={schemaVersion:1,pool:"pool",before:"cursor",seen:["a"],events:[],pendingSignatures:[],classification:"AMOUNT_RECONCILED_AUTHORIZATION_PENDING",complete:false,historyCoverageVerified:false,authorizationVerified:false,withdrawalVerified:false,finalScore:null,requestCount:5,reconciliation:{verifiedDistinct:34,recoveredPending:2}};
test("rejects newest corrupt checkpoint rather than rolling back",()=>{
 assert.throws(()=>selectLiquidityContinuationCheckpoint([{runId:100,state},{runId:101,state:{...state,finalScore:8}}],"pool"),/NEWER_CHECKPOINT_INVALID/);
});
