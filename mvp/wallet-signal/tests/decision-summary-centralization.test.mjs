import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../lib/decisionSummary.js", import.meta.url), "utf8");
const { buildDecisionSummary } = await import("data:text/javascript," + encodeURIComponent(source));

test("issuer controls are described as centralization rather than elevated concern", () => {
 const a = buildDecisionSummary({result:{mintAuthority:"issuer",freezeAuthority:"issuer",tokenProgram:"spl-token",authorityDetailsStatus:"parsed"}});
 assert.equal(a.status,"CENTRALIZED_CONTROLS_OBSERVED");
 assert.equal(a.title,"Centralized token controls detected");
 assert.match(a.explanation,/do not by themselves demonstrate malicious behavior/);
});
test("missing authority fields are not counted as checked", () => {
 const a = buildDecisionSummary({result:{tokenProgram:"spl-token",authorityDetailsStatus:"parsed"}});
 assert.equal(a.coverageCount,1);
 assert.ok(!a.findings.some(x=>x.title==="Mint and freeze controls"));
});
test("large token accounts trigger investigation without assuming ownership", () => {
 const a = buildDecisionSummary({result:{mintAuthority:null,freezeAuthority:null,tokenProgram:"spl-token"},concentration:{largestAccountSharePct:35}});
 assert.equal(a.status,"CONCENTRATION_REVIEW");
 assert.match(a.explanation,/beneficial owner and role are not established/);
});
