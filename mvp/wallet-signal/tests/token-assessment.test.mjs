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

test("verified creator attribution increases verified coverage but does not score safety",()=>{
 const a=assessTokenEvidence({creatorEvidence:{creator:"CreatorWallet123",status:"VERIFIED"}});
 const row=a.attributes.find(x=>x.id==="creator");
 assert.equal(row.coverage,"verified");
 assert.match(row.assessment,/independently verified/);
 assert.equal(a.verifiedAttributes,1);
 assert.equal(a.partialAttributes,0);
 assert.equal(a.missingAttributes,4);
 assert.equal(a.verifiedCoveragePct,20);
 assert.equal(a.consolidatedScore,null);
});
test("pending creator review remains partial, not verified",()=>{
 const a=assessTokenEvidence({creatorEvidence:{creator:"CreatorWallet123",status:"ONCHAIN_MATCH_PENDING_INDEPENDENT_REVIEW"}});
 assert.equal(a.attributes.find(x=>x.id==="creator").coverage,"partial");
 assert.equal(a.verifiedCoveragePct,0);
});
test("unknown creator remains missing, even with a wallet label",()=>{
 const a=assessTokenEvidence({creatorEvidence:{creator:"CreatorWallet123",status:"UNVERIFIED"}});
 assert.equal(a.attributes.find(x=>x.id==="creator").coverage,"missing");
 assert.equal(a.evidenceCoveragePct,0);
});
test("mixed coverage is counted without treating partial as verified",()=>{
 const a=assessTokenEvidence({creatorEvidence:{creator:"CreatorWallet123",status:"VERIFIED"},concentration:{largestAccountSharePct:30},liquidity:{reportedLiquidityUsd:5000}});
 assert.equal(a.verifiedAttributes,1);
 assert.equal(a.partialAttributes,2);
 assert.equal(a.missingAttributes,2);
 assert.equal(a.evidenceCoveragePct,60);
 assert.equal(a.verifiedCoveragePct,20);
});

test("top findings prioritize observed cautions and provide next steps",()=>{
 const a=assessTokenEvidence({result:{mintAuthority:"active",freezeAuthority:null},concentration:{largestAccountSharePct:25},liquidity:{reportedLiquidityUsd:10000}});
 assert.equal(a.actionableFindings.length,3);
 assert.equal(a.actionableFindings[0].id,"permissions");
 assert.equal(a.actionableFindings[0].severity,"caution");
 assert.equal(a.actionableFindings[1].id,"concentration");
 assert.ok(a.actionableFindings.every(x=>x.nextStep && x.evidence && x.source));
 assert.equal(a.consolidatedScore,null);
});
test("no evidence yields no invented top findings",()=>{
 const a=assessTokenEvidence({});
 assert.deepEqual(a.actionableFindings,[]);
});
