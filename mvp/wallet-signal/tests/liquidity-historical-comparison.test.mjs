import test from "node:test";
import assert from "node:assert/strict";
import {comparePoolVaultSnapshots} from "../lib/liquidityHistoricalComparison.mjs";
const sample=(base,quote)=>({pairAddress:"pool",vaultAccountEvidence:{base:{verified:true,rawAmount:String(base)},quote:{verified:true,rawAmount:String(quote)},authorityAssessment:{authorityEvidenceComplete:true}}});
test("computes raw changes without asserting withdrawals",()=>{
 const r=comparePoolVaultSnapshots([sample(100,200)],[sample(90,220)]);
 assert.equal(r.comparedPools,1);
 assert.equal(r.pools[0].baseRawDelta,"-10");
 assert.equal(r.pools[0].quoteRawDelta,"20");
 assert.equal(r.pools[0].withdrawalConfirmed,false);
});
test("rejects unverified historical vault evidence",()=>{
 const r=comparePoolVaultSnapshots([{pairAddress:"pool"}],[sample(10,20)]);
 assert.equal(r.comparedPools,0);
 assert.equal(r.liquidityStabilityVerified,false);
});
