import {summarizeCreatorAcquisitionLedger} from '../lib/creatorAcquisitionLedger.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {projectCreatorCheckpoint,projectLiquidityCheckpoint,readDashboardEvidence} from '../lib/dashboardEvidenceBridge.mjs';
import {adaptDashboardEvidence,evidenceFresh} from '../lib/glitchDashboardEvidenceV11.mjs';
import {scoreHolderIntelligence} from '../lib/glitchAttributeEnginesV11.mjs';
import {consolidate} from '../lib/glitchScoringV11.mjs';
const mint='So11111111111111111111111111111111111111112',creator='11111111111111111111111111111111';
const updatedAt='2026-10-20T06:00:00Z',now=Date.parse(updatedAt);
const base={result:{mint,tokenProgram:'spl-token',mintAuthority:null,freezeAuthority:null},now};
const row={mint,status:'partial',stage:'selling',updated_at:updatedAt,state:{originEvidence:[{creator}],holdings:{mint,creator,status:'ONCHAIN_BALANCE_OBSERVED',supplySharePct:5,balanceObservedAt:updatedAt,holdingsScoreEligible:true},previousLaunches:{attributedLaunchCount:2},secret:'must not leak'}};
test('observed holdings and launch counts are not scores',()=>{
 const c=projectCreatorCheckpoint(row,mint);
 assert.equal(c.holdings.supplySharePct,5);assert.equal(c.holdings.scoreEligible,false);assert.equal(c.previousLaunchCount,2);assert.equal(c.secret,undefined);
 const a=adaptDashboardEvidence({...base,creatorEvidence:{mint,creator,status:'VERIFIED',independentlyReviewed:true},workerEvidence:{version:'1.1',mint,creator:c}});
 assert.equal(a.scores.creator_intelligence.coveragePct,20);assert.equal(a.scores.creator_intelligence.score,null);assert.equal(consolidate(a.scores).score,null);
});
test('selling requires complete matched fresh evidence and all3windows',()=>{
 const ready={...row,state:{...row.state,creatorHistoryComplete:true,initialAllocationEvidence:{status:'INITIAL_ALLOCATION_EVIDENCE_COMPLETE',coverageComplete:true,initialAttributableRaw:'100'},selling:{methodology:'CREATOR_SELLING_V1_1',creatorSellingScoreEligible:true,windows:[3600,86400,604800].map(seconds=>({seconds,historyComplete:true,scoreEligible:true,verifiedSoldRaw:'0',sellThroughPct:0}))}}};
 ready.state.creatorVerifiedAcquisitionEvents=[{mint,creator,signature:'launch',instructionIndex:0,innerInstructionIndex:null,type:'LAUNCH_DISTRIBUTION',amountRaw:'100',timestamp:100,independentlyVerified:true,instructionVerified:true,launchInstructionVerified:true}];
 ready.state.creatorAcquisitionAttributionComplete=true;
 ready.state.creatorAcquisitionLedger=summarizeCreatorAcquisitionLedger({mint,creator,events:ready.state.creatorVerifiedAcquisitionEvents,historyComplete:true,attributionComplete:true});
 const c=projectCreatorCheckpoint(ready,mint);
 const args={...base,creatorEvidence:{mint,creator,status:'VERIFIED',independentlyReviewed:true},workerEvidence:{version:'1.1',mint,creator:c}};
 assert.equal(adaptDashboardEvidence(args).scores.creator_intelligence.components[2].points,30);
 for(const changed of [{...c,mint:'other'},{...c,creator:'other'},{...c,updatedAt:'2026-10-19T00:00:00Z'}])assert.equal(adaptDashboardEvidence({...args,workerEvidence:{version:'1.1',mint,creator:changed}}).scores.creator_intelligence.components[2].points,null);
 ready.state.selling.windows.pop();assert.equal(projectCreatorCheckpoint(ready,mint).selling,null);
 assert.throws(()=>projectCreatorCheckpoint(row,'other'),/MISMATCH/);
});
test('stage1 liquidity only projects observation counts',()=>{
 const source={mint,updated_at:updatedAt,evidence:{mint,schemaVersion:1,observedAt:updatedAt,pools:[{}],batchErrors:[],finalScore:null,verifiedDepth:false,lpSecurityVerified:false,status:'partial'}};
 const l=projectLiquidityCheckpoint(source,mint);assert.equal(l.checkedPoolCount,1);
 assert.equal(adaptDashboardEvidence({...base,workerEvidence:{version:'1.1',mint,liquidity:l}}).scores.liquidity_quality_safety.coveragePct,0);
 assert.throws(()=>projectLiquidityCheckpoint({...source,evidence:{...source.evidence,verifiedDepth:true}},mint),/UNSUPPORTED/);
});
test('holder assessment needs mint job time and snapshot identity match',()=>{
 const holders=Array.from({length:20},(_,i)=>({tokenAccount:'account'+i,ownerWallet:'owner'+i,sharePct:1}));
 const assessment=scoreHolderIntelligence({top20SharePct:20});assessment.components[1].reason='HISTORICAL_COVERAGE_UNVERIFIED';
 const args={...base,concentration:{mint,accounts:holders,top20TokenAccountSharePct:20},historicalHolders:{mint,jobId:'job',updatedAt,holders},verifiedHolderEnvelope:{mint,jobId:'job',updatedAt,assessment}};
 assert.equal(adaptDashboardEvidence(args).matchedHolder,true);assert.equal(adaptDashboardEvidence(args).scores.holder_intelligence.components[1].reason,'HISTORICAL_COVERAGE_UNVERIFIED');
 for(const mismatch of [{jobId:'other'},{mint:'other'},{updatedAt:'2026-10-19T00:00:00Z'}])assert.equal(adaptDashboardEvidence({...args,verifiedHolderEnvelope:{...args.verifiedHolderEnvelope,...mismatch}}).matchedHolder,false);
 assert.equal(adaptDashboardEvidence({...args,concentration:{...args.concentration,accounts:[]}}).matchedHolder,false);
 assert.equal(adaptDashboardEvidence({...args,concentration:{...args.concentration,accounts:holders.map((h,i)=>i? h:{...h,sharePct:2})}}).matchedHolder,false);
 assert.equal(adaptDashboardEvidence({...args,concentration:{mint:'other',top20TokenAccountSharePct:20}}).scores.holder_intelligence.coveragePct,0);
 const numeric={...args,verifiedHolderEnvelope:{...args.verifiedHolderEnvelope,assessment:scoreHolderIntelligence({top20SharePct:20,networkScore:30,creatorTeamExposurePct:2,independencePoints:8,historyComplete:true,classificationComplete:true,creatorAttributionComplete:true})},concentration:{...args.concentration,accounts:holders.map((h,i)=>i?h:{...h,sharePct:2})}};
 assert.equal(adaptDashboardEvidence(numeric).scores.holder_intelligence.components[1].points,null);
 assert.equal(adaptDashboardEvidence(numeric).scores.holder_intelligence.components[2].points,null);
});
test('fee newer schedule remains pending; verified extension absence is N/A',()=>{
 const args={...base,result:{...base.result,tokenProgram:'spl-token-2022'},extensions:{mint,verified:true,observedAt:updatedAt,transferFee:{status:'observed',newerFee:{percentage:0},configAuthorityReported:true,configAuthority:null}}};
 assert.equal(adaptDashboardEvidence(args).scores.token_security.components[0].points,null);
 args.extensions.transferFee.status='not_observed';assert.equal(adaptDashboardEvidence(args).scores.token_security.components[0].reason,'not_applicable');
 args.extensions.mint='other';assert.equal(adaptDashboardEvidence(args).scores.token_security.components[0].reason,undefined);
});
test('undated stale and future evidence fail freshness',()=>{
 assert.equal(evidenceFresh(updatedAt,now),true);
 for(const date of [null,'bad','2026-10-20T06:00:01Z','2026-10-19T00:00:00Z'])assert.equal(evidenceFresh(date,now),false);
});
test('read bridge is GET-only, independently handles missing tables and redacts',async()=>{
 const calls=[];const out=await readDashboardEvidence({mint,url:'https://example.supabase.co',key:'secret',fetchImpl:async(url,options)=>{
  calls.push({url,options});return url.includes('creator_intelligence_jobs')?{ok:true,json:async()=>[row]}:{ok:false,status:404};
 }});
 assert.equal(calls.length,2);assert.ok(calls.every(x=>x.options.method==='GET'&&x.options.cache==='no-store'));
 assert.equal(out.creator.holdings.supplySharePct,5);assert.equal(out.liquidity.status,'unavailable');assert.ok(!JSON.stringify(out).includes('secret'));
});
