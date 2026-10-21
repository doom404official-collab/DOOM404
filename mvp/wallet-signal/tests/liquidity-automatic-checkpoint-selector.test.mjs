import test from "node:test";
import assert from "node:assert/strict";
import {selectLiquidityContinuationCheckpoint} from "../lib/liquidityAutomaticCheckpointSelector.mjs";
const base={schemaVersion:1,pool:"pool",seen:["a"],events:[],before:"cursor",pendingSignatures:[],complete:false,classification:"AMOUNT_RECONCILED_AUTHORIZATION_PENDING",authorizationVerified:false,withdrawalVerified:false,historyCoverageVerified:false,finalScore:null,requestCount:5,reconciliation:{verifiedDistinct:34,recoveredPending:2}};
test("select latest safe checkpoint",()=>assert.equal(selectLiquidityContinuationCheckpoint([{runId:1,state:base},{runId:2,state:{...base,seen:["a","b"],requestCount:6}}],"pool").runId,2));
test("reject rollback and unsafe states",()=>{
 assert.throws(()=>selectLiquidityContinuationCheckpoint([{runId:1,state:{...base,seen:["a","b"]}},{runId:2,state:base}],"pool"),/LINEAGE/);
 assert.throws(()=>selectLiquidityContinuationCheckpoint([{runId:1,state:{...base,finalScore:1}}],"pool"),/NO_VALID/);
});
