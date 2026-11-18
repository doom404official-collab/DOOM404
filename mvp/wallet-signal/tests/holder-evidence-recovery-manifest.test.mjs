import test from "node:test";
import assert from "node:assert/strict";
import {buildHolderEvidenceRecoveryManifest} from "../lib/holderEvidenceRecoveryManifest.mjs";
test("deduplicates across jobs and preserves legacy evidence classification",()=>{
 const jobs=[
  {id:"a",checkpoint:{signatures:{s1:"checked",s2:"checked",s3:"pending"},edges:{},networkEvidence:{processed:{s1:{valid:true,unresolvedTokenTransfers:0}}}}},
  {id:"b",checkpoint:{signatures:{s1:"checked",s2:"checked",s4:"checked"},edges:{},networkEvidence:{processed:{}}}}
 ];
 const result=buildHolderEvidenceRecoveryManifest({jobs,validations:[{job_id:"a",signature:"s2",status:"verified"}]});
 assert.equal(result.uniqueCheckedSignatures,3);
 assert.equal(result.duplicateJobReferences,2);
 assert.deepEqual(result.totals,{networkRetained:1,legacyVerified:1,legacyPending:0,legacyEdgeUnvalidated:0,unclassifiedChecked:1});
 assert.equal(result.rpcRetrievalAuthorized,false);
 assert.equal(result.scorePromotionAuthorized,false);
});
test("legacy direct edge does not become full network evidence",()=>{
 const result=buildHolderEvidenceRecoveryManifest({jobs:[{id:"a",checkpoint:{signatures:{sig:"checked"},edges:{pair:{signatures:["sig"]}}}}]});
 assert.equal(result.totals.legacyEdgeUnvalidated,1);
 assert.equal(result.totals.networkRetained,0);
});
