import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src=readFileSync(new URL("../lib/tokenAssessment.js",import.meta.url),"utf8");
const {assessTokenEvidence}=await import("data:text/javascript,"+encodeURIComponent(src));
test("missing evidence never becomes zero or an overall score",()=>{
 const a=assessTokenEvidence({});
 assert.equal(a.consolidatedScore,null);
 assert.equal(a.evidenceCoveragePct,0);
 assert.ok(a.attributes.every(x=>x.score===null));
});
test("observed concentration does not imply beneficial ownership",()=>{
 const a=assessTokenEvidence({concentration:{largestAccountSharePct:4.087}});
 const row=a.attributes.find(x=>x.id==="concentration");
 assert.equal(row.score,null);
 assert.match(row.explanation,/do not establish unique beneficial owners/);
});
test("present permissions are explained without alleging misuse",()=>{
 const a=assessTokenEvidence({result:{mintAuthority:"address",freezeAuthority:null}});
 const row=a.attributes.find(x=>x.id==="permissions");
 assert.equal(row.score,35);
 assert.match(row.explanation,/not proof of misuse/);
 assert.equal(a.consolidatedScore,null);
});
test("provider liquidity is not scored as verified resilience",()=>{
 const a=assessTokenEvidence({liquidity:{reportedLiquidityUsd:2100000}});
 assert.equal(a.attributes.find(x=>x.id==="liquidity").score,null);
 assert.equal(a.consolidatedStatus,"withheld_incomplete_evidence");
});
