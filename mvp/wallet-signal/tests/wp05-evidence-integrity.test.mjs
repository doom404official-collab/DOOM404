import test from 'node:test';
import assert from 'node:assert/strict';
import {practicalAssessmentV2} from '../lib/practicalScoringV2.mjs';
import {holderSampleLabel} from '../lib/evidenceHudPresentation.mjs';
import {replay} from './fixtures/ui-assessment-replay.mjs';
test('stale frozen holder evidence cannot override current mint evidence or earn current coverage',()=>{
 const r=replay();r.workerEvidence.canonicalHolder.observedAt=new Date(Date.now()-86400000).toISOString();
 const a=practicalAssessmentV2(r).scores.holder_intelligence;
 assert.equal(a.metrics.top20Pct,null);assert.equal(a.components[0].observedWeight,0);assert.equal(a.coveragePct,0);
});
test('an invalid raw holder proof cannot produce concentration score, coverage or critical evidence',()=>{
 const r=replay();delete r.workerEvidence.canonicalHolder;
 r.concentration={mint:r.result.mint,sampledWalletObservation:{version:2,observedAt:r.result.observedAt,atomicSubset:true,eligibleWallets:1,supplyRaw:'100',wallets:[{wallet:'a',amountRaw:'49'}],observedSharePct:90,largestSharePct:90,contextSlots:{mint:1,sampledAccounts:1}}};
 const a=practicalAssessmentV2(r).scores.holder_intelligence;
 assert.equal(a.riskScore,0);assert.equal(a.coveragePct,0);assert.equal(a.flags.length,0);
});
test('a small outstanding LP claim does not prove actual withdrawal rights',()=>{
 const r=replay();let a=practicalAssessmentV2(r).scores.liquidity_quality_safety;
 assert.equal(a.components[1].complete,false);assert.equal(a.coveragePct,65);assert.match(a.missing.join(' '),/actual withdrawal rights are unverified/);
 r.currentLiquidity.withdrawal.actualRightsVerified=true;r.currentLiquidity.withdrawal.currentRedemptionRulesVerified=true;
 a=practicalAssessmentV2(r).scores.liquidity_quality_safety;assert.equal(a.components[1].complete,true);assert.equal(a.coveragePct,100);
});
test('twenty unordered owners are described as a sample, never a proven ranked Top20',()=>{
 assert.equal(holderSampleLabel(20,false),'Sampled 20 wallets');assert.equal(holderSampleLabel(20,true),'Top-20 wallets');assert.equal(holderSampleLabel(17),'Sampled 17 wallets');
});
