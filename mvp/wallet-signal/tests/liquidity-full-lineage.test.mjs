import test from "node:test";
import assert from "node:assert/strict";
import {selectLiquidityContinuationCheckpoint} from "../lib/liquidityAutomaticCheckpointSelector.mjs";
const state={schemaVersion:1,pool:"pool",before:"cursor",seen:["a"],events:[],pendingSignatures:[],classification:"AMOUNT_RECONCILED_AUTHORIZATION_PENDING",complete:false,historyCoverageVerified:false,authorizationVerified:false,withdrawalVerified:false,finalScore:null,requestCount:5,reconciliation:{verifiedDistinct:34,recoveredPending:2,sourceDigest:"origin"}};
test("rejects lineage regressions beyond newest two checkpoints",()=>{
 const c=[{runId:3,state:{...state,seen:["a","b","c"],requestCount:7}},{runId:2,state:{...state,seen:["a","b"],requestCount:6}},{runId:1,state:{...state,seen:["a","x"],requestCount:5}}];
 assert.throws(()=>selectLiquidityContinuationCheckpoint(c,"pool"),/LINEAGE_REGRESSION/);
});
test("rejects reconciliation source drift",()=>{
 const c=[{runId:3,state:{...state,seen:["a","b"],requestCount:7}},{runId:2,state:{...state,reconciliation:{...state.reconciliation,sourceDigest:"other"}}}];
 assert.throws(()=>selectLiquidityContinuationCheckpoint(c,"pool"),/SOURCE_DRIFT/);
});
