import test from "node:test";
import assert from "node:assert/strict";
import {commitExternalNetworkEvidence} from "../lib/commitExternalNetworkEvidence.mjs";
test("busy lease never reads or commits",async()=>{
 let reads=0,commits=0;
 const result=await commitExternalNetworkEvidence({jobId:"job",expectedMint:"mint",allowedSignatures:["sig"],limit:3,
  jobStore:{claim:async()=>null,getById:async()=>{reads++},commit:async()=>{commits++}},
  evidenceStore:{listForJob:async()=>[]}});
 assert.equal(result.status,"lease_unavailable");
 assert.equal(reads,0);assert.equal(commits,0);
});
test("stale version never commits",async()=>{
 let commits=0;
 const jobStore={claim:async()=>({id:"job",mint:"mint",status:"running",version:2}),
  getById:async()=>({id:"job",mint:"mint",status:"running",version:3}),
  commit:async()=>{commits++}};
 await assert.rejects(commitExternalNetworkEvidence({jobId:"job",expectedMint:"mint",allowedSignatures:["sig"],limit:3,
  jobStore,evidenceStore:{listForJob:async()=>[]}}),/VERSION_CHANGED/);
 assert.equal(commits,0);
});
test("wrong claimed mint fails closed",async()=>{
 let reads=0;
 await assert.rejects(commitExternalNetworkEvidence({jobId:"job",expectedMint:"mint",allowedSignatures:["sig"],limit:3,
  jobStore:{claim:async()=>({id:"job",mint:"wrong",status:"running",version:2}),getById:async()=>{reads++}},
  evidenceStore:{listForJob:async()=>[]}}),/CLAIM_MISMATCH/);
 assert.equal(reads,0);
});
