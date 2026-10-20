import test from "node:test";
import assert from "node:assert/strict";
import {comparePoolVaultSnapshots} from "../lib/liquidityHistoricalComparison.mjs";
const sample=(base,quote)=>({pairAddress:"pool",decodedPumpAmmCandidate:{baseMint:"base",quoteMint:"quote",poolBaseTokenAccount:"baseVault",poolQuoteTokenAccount:"quoteVault"},vaultAccountEvidence:{base:{verified:true,mint:"base",authority:"pool",tokenProgram:"spl",rawAmount:String(base)},quote:{verified:true,mint:"quote",authority:"pool",tokenProgram:"spl",rawAmount:String(quote)},authorityAssessment:{authorityEvidenceComplete:true}}});
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

test("malformed raw balances and incompatible identities are rejected without throwing",()=>{
 for(const mutate of [p=>p.vaultAccountEvidence.base.rawAmount="bad",p=>p.vaultAccountEvidence.base.rawAmount=9007199254740992,p=>p.vaultAccountEvidence.base.mint="other",p=>p.decodedPumpAmmCandidate.poolBaseTokenAccount="other",p=>p.vaultAccountEvidence.base.authority="other",p=>p.vaultAccountEvidence.base.tokenProgram="other"]){
  const old=sample(100,200); mutate(old);
  const r=comparePoolVaultSnapshots([old],[sample(90,220)]);
  assert.equal(r.comparedPools,0); assert.equal(r.rejectedPools.length,1); assert.equal(r.liquidityStabilityVerified,false);
 }
});
test("duplicate pool snapshots never create a comparison",()=>{
 assert.equal(comparePoolVaultSnapshots([sample(1,2),sample(3,4)],[sample(5,6)]).comparedPools,0);
 assert.equal(comparePoolVaultSnapshots([sample(1,2)],[sample(5,6),sample(7,8)]).comparedPools,0);
});
test("large raw balances remain exact",()=>{
 assert.equal(comparePoolVaultSnapshots([sample("18446744073709551615",2)],[sample("18446744073709551614",2)]).pools[0].baseRawDelta,"-1");
});
