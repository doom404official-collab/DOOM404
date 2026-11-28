import {aggregateRisk} from '../lib/riskMethodology.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {practicalAssessmentV2} from '../lib/practicalScoringV2.mjs';import {projectPumpLiquidityV2} from '../lib/pumpLiquidityAssessmentV2.mjs';import {projectCreatorBehaviourV2} from '../lib/creatorBehaviourV2.mjs';import {projectHolderRelationshipsV2} from '../lib/holderRelationshipsV2.mjs';
import {decodeToken2022BinaryMint} from '../lib/token2022BinaryMint.mjs';import {projectSecurityConfiguration} from '../lib/securityConfigurationV2.mjs';
const load=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url))),raw=load('./fixtures/scoring-v2-current-accounts.json'),cp=load('./fixtures/canonical-holder-checkpoint-20261126.json'),mint=raw.addresses[3],creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
const now=Date.parse(raw.observedAt),info=decodeToken2022BinaryMint(raw.response.value[3],mint).data.parsed.info;
function args(){return {result:{mint,tokenProgram:'spl-token-2022',authorityDetailsStatus:'available',mintAuthority:null,freezeAuthority:null,supplyRaw:info.supply},extensions:{mint,verified:true,observedAt:raw.observedAt,configuration:projectSecurityConfiguration(info,{slot:raw.response.context.slot,commitment:'finalized'}),transferFee:{status:'not_observed'}},workerEvidence:{version:'1.1',mint,canonicalHolder:{schemaVersion:2,mint,status:'canonical_observation',observedAt:raw.observedAt,snapshotId:cp.snapshot.id,holderSetHash:cp.snapshot.holderSetHash,top20SharePct:24.5379,largestHolderSharePct:2.1151,contextSlots:{inventory:474029636}},holderRelationships:projectHolderRelationshipsV2({mint,holder_set_hash:cp.snapshot.holderSetHash,checkpoint:cp},mint),liquidity:{mint,currentScoringV2:projectPumpLiquidityV2(raw,mint)}},now};}
test('observed risk is not normalized to sparse evidence and approved revised overall weights apply',()=>{
 const a=practicalAssessmentV2(args());assert.equal(a.scores.token_security.riskScore,0);assert.equal(a.scores.token_security.coveragePct,100);assert.equal(a.scores.holder_intelligence.coveragePct,70);assert.ok(a.scores.holder_intelligence.metrics.connectedExposurePct>2);assert.equal(a.scores.liquidity_quality_safety.coveragePct,65);assert.equal(a.scores.creator_intelligence.coveragePct,0);assert.equal(a.coveragePct,58.75);
 assert.equal(a.riskScore,aggregateRisk(a.scores).riskScore);assert.equal(a.status,'limited_assessment');
 const missing=practicalAssessmentV2({result:{mint}});assert.equal(missing.coveragePct,0);assert.equal(missing.complete,false);assert.equal(missing.riskScore,0);assert.ok(missing.unresolved.length>0);
});
test('freeze and hook restrictions are not counted twice; distribution and largest holder use maximum pressure',()=>{
 const a=args();a.workerEvidence.canonicalHolder.largestHolderSharePct=20;const r=practicalAssessmentV2(a);assert.equal(r.scores.holder_intelligence.components[0].riskPoints,70);
 a.workerEvidence.canonicalHolder.holderSetHash='bad';assert.equal(practicalAssessmentV2(a).scores.holder_intelligence.coveragePct,0);
});
test('fresh direct wallet exposure can be measured without claiming completed historical selling',()=>{
 const a=args();a.creatorEvidence={mint,creator,status:'VERIFIED',independentlyReviewed:true};a.currentCreator={version:2,mint,creator,status:'verified_current_wallet',rawBalance:'599036011328',observedAt:raw.observedAt,slot:raw.response.context.slot};
 const r=practicalAssessmentV2(a);assert.equal(r.scores.creator_intelligence.coveragePct,60);assert.equal(r.scores.creator_intelligence.riskScore,0);assert.equal(r.scores.creator_intelligence.metrics.lifetimeSellingPct,null);assert.equal(r.coveragePct,70.75);
});

test('render recomputation never mutates retained flags or duplicates current warnings',()=>{
 const a=args();a.reportedLiquidity={mint,status:'pools_reported',observedAt:raw.observedAt,poolCountReturned:1,largestReportedPoolSharePct:99};a.workerEvidence.liquidity.lq09Observation={mint,creatorRecipientMatchesHistoricalState:false};
 const before=JSON.stringify(a);for(let i=0;i<5;i++){const result=practicalAssessmentV2(a),flags=result.scores.liquidity_quality_safety.flags;assert.equal(flags.filter(f=>f.id==='reported_pool_concentration').length,1);assert.equal(flags.filter(f=>f.id==='historical_fee_recipient_mismatch').length,1);}
 assert.equal(JSON.stringify(a),before);
});

test('quote-only liquidity keeps unknown LP controls without crashing or inventing coverage',()=>{
 const a=args();a.currentLiquidity={...load('./fixtures/usdc-executable-route-calibration.json'),version:2,mint,observedAt:raw.observedAt,withdrawal:null};const r=practicalAssessmentV2(a);assert.equal(r.scores.liquidity_quality_safety.coveragePct,50);assert.equal(r.scores.liquidity_quality_safety.metrics.maxCurrentWithdrawalPct,null);assert.equal(r.scores.liquidity_quality_safety.metrics.lpHolders,undefined);
 const b=args();b.workerEvidence.liquidity.currentScoringV2.referenceQuotes[2]={referenceNotional:100,quoteSymbol:'SOL',impactIncludingFeesPct:null,executable:false,reason:'insufficient_real_quote_reserves'};const blocked=practicalAssessmentV2(b);assert.equal(blocked.scores.liquidity_quality_safety.components[0].riskPoints,50);assert.equal(blocked.scores.liquidity_quality_safety.components[0].complete,true);
});
