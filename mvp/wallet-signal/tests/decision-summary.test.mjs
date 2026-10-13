import test from "node:test";
import assert from "node:assert/strict";
import { buildDecisionSummary } from "../lib/decisionSummary.js";
test("no evidence yields insufficient evidence, not false low risk",()=>{
 const x=buildDecisionSummary({});
 assert.equal(x.status,"INSUFFICIENT_EVIDENCE");
 assert.equal(x.isInvestmentAdvice,false);
});
test("cached creator plus controls produces useful caution",()=>{
 const x=buildDecisionSummary({
  result:{tokenProgram:"spl-token",mintAuthority:null,freezeAuthority:null},
  concentration:{largestAccountSharePct:10.97},
  liquidity:{reportedLiquidityUsd:31250},
  creatorEvidence:{status:"ONCHAIN_MATCH_PENDING_INDEPENDENT_REVIEW",creator:"EQFgSvmavjfcvovYvgfETTcYvYzpHntqxkvDUViBTtZr",evidence:[{signature:"x"}]}
 });
 assert.equal(x.status,"CAUTION_PARTIAL_EVIDENCE");
 assert.ok(x.findings.length>0);
 assert.ok(x.findings.some(f=>f.title.includes("Creator")));
});
test("active mint authority raises observed concern without scam claim",()=>{
 const x=buildDecisionSummary({result:{mintAuthority:"authority",freezeAuthority:null,tokenProgram:"spl-token"}});
 assert.equal(x.status,"ELEVATED_OBSERVED_CONCERN");
});
