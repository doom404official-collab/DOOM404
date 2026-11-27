import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregateRisk,RISK_WEIGHTS,LEGACY_RISK_WEIGHTS,tokenMaturity} from '../lib/riskMethodology.mjs';
import {practicalAssessmentV2} from '../lib/practicalScoringV2.mjs';
const ids=Object.keys(RISK_WEIGHTS),mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const scores=(risks,coverage)=>Object.fromEntries(ids.map((id,i)=>[id,{riskScore:risks[i],coveragePct:coverage[i]}]));
for(const [name,risks,coverage,old,risk,cov] of [
 ['reference',[0,17.28,24.69,6.64],[100,70,100,60],12.15,15.15,83],
 ['random replay (truncated mint, not a live identifier)',[0,26.18,59.19,0],[100,66.5,100,60],21.34,28.57,81.95]
])test(name,()=>{const a=scores(risks,coverage);assert.equal(aggregateRisk(a,LEGACY_RISK_WEIGHTS).riskScore,old);assert.deepEqual(aggregateRisk(a),{riskScore:risk,coveragePct:cov});});
for(const [i,expected] of [15,30,35,20].entries())test('isolated extreme '+ids[i],()=>{const risks=[0,0,0,0];risks[i]=100;assert.equal(aggregateRisk(scores(risks,[100,100,100,100])).riskScore,expected);});
test('coverage never renormalizes zero observed risk or unavailable attributes',()=>{
 assert.deepEqual(aggregateRisk(scores([0,0,0,0],[100,0,0,0])),{riskScore:0,coveragePct:15});
 assert.deepEqual(aggregateRisk(scores([100,100,100,100],[0,0,0,0])),{riskScore:100,coveragePct:0});
 assert.throws(()=>aggregateRisk(scores([NaN,0,0,0],[100,100,100,100])));
});
test('maturity has exact boundaries and no age penalty',()=>{
 const now=1800000000000;
 const labels=['Extremely early stage','Newly launched','Early stage','Developing','Established trading history','Established trading history','Longer trading history'];
 for(const [i,seconds] of [3599,3600,86400,7*86400,30*86400,90*86400,90*86400+1].entries()){
  const attribution={mint,verified:true,verification:'transaction_local_protocol_creator',creationSignature:'proof',creationSlot:1,creationTime:now/1000-seconds};
  assert.equal(tokenMaturity({mint,attribution,now}).label,labels[i]);
 }
 assert.equal(tokenMaturity({mint,attribution:{creationTime:123}}).label,'Maturity not established');
});
test('material creator gap remains unresolved, no manufactured missing balance or score penalty',()=>{
 const now=Date.now(),creator='creator',ledger={purchasedRaw:'426004962756358',verifiedSoldRaw:'0',burnedRaw:'0',externalTransferredOutRaw:'1139995'};
 const r=practicalAssessmentV2({now,result:{mint,supplyRaw:'1000000000000000'},currentCreator:{mint,version:2,creator,status:'verified_current_wallet',rawBalance:'21194214',observedAt:new Date(now).toISOString(),slot:2,attribution:{verified:true,verification:'transaction_local_protocol_creator'}},workerEvidence:{mint,version:'1.1',creator:{mint,attribution:{verified:true,verification:'transaction_local_protocol_creator',creator},behaviourV2:{mint,creator,version:2,ledger}}}});
 assert.ok(r.flags.some(f=>f.id==='creator_disposition_unresolved'));
 assert.equal(r.scores.creator_intelligence.metrics.currentWalletRaw,'21194214');
 assert.equal(r.scores.creator_intelligence.metrics.missingBalanceRaw,undefined);
 assert.equal(r.scores.creator_intelligence.coveragePct,60);
 assert.ok(r.scores.creator_intelligence.riskScore<0.01);
});

test('critical warnings stay in the scoreboard and top insights without a numerical floor',async()=>{
 const {loadJSX}=await import('./helpers/render-jsx.mjs');const {createElement}=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');
 const Panel=loadJSX(new URL('../app/PracticalAssessmentPanel.jsx',import.meta.url)).default;
 const base=practicalAssessmentV2({result:{mint,tokenProgram:'spl-token',authorityDetailsStatus:'available',mintAuthority:null,freezeAuthority:null}});
 const f={id:'selling_disabled',severity:'critical',detail:'Verified restricted sale'};
 base.flags=[f,{id:'severe_reference_exit_cost',severity:'critical',detail:'Severe exit cost'}];base.criticalRisk=true;
 base.coveragePct=100;base.riskScore=15;
 const html=renderToStaticMarkup(createElement(Panel,{assessment:base,selected:'overall'}));
 assert.ok(html.indexOf('Critical risk observed')<html.indexOf('Attribute score summary'));
 assert.ok(html.indexOf('Verified restricted sale')<html.indexOf('Three important insights'));
 assert.equal(base.riskScore,15);assert.match(html,/Maturity not established/);
});

test('material acquisition triggers bounded token-account history and cached-event reuse',async()=>{
 const fs=await import('node:fs');const {investigateToken}=await import('../lib/boundedTokenInvestigation.mjs');
 const f=JSON.parse(fs.readFileSync(new URL('./fixtures/creator-launch-447328096.json',import.meta.url)));
 const calls=[];
 const rpc=async(method,params)=>{
  calls.push({method,params});
  if(method==='getTransactionsForAddress')return {data:[f.transaction]};
  if(method==='getTokenLargestAccounts')return {context:{slot:1},value:[{address:mint}]};
  if(method==='getMultipleAccounts')return {context:{slot:2},value:[{executable:false,owner:'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',data:{parsed:{type:'mint',info:{isInitialized:true,supply:'1000000000000000',decimals:6}}}}]};
  if(method==='getSignaturesForAddress')return [];
  if(method==='getTokenAccountsByOwner')return {context:{slot:3},value:[]};
  throw Error('unexpected '+method);
 };
 const a=await investigateToken({mint,rpc});
 assert.equal(a.adaptiveCreator.status,'bounded_early_history_assessed');
 assert.equal(a.adaptiveCreator.additionalRequests,2);assert.ok(a.execution.requests<=18);
 assert.ok(a.eventReceipts.some(r=>r.slot===447328096&&r.mintDecimals===6));
 assert.equal(calls.filter(c=>c.method==='getTransactionsForAddress').length,2);
 const b=await investigateToken({mint,rpc,previousObservation:a});
 assert.equal(b.creator.behaviourV2.ledger.purchasedRaw,a.creator.behaviourV2.ledger.purchasedRaw);
});

test('independent holder snapshot survives concentration refresh without claiming independence',()=>{
 const now=Date.now(),rel={mint,version:2,snapshotSlot:100,supplyRaw:'10000',observedAt:new Date(now).toISOString(),sampleWallets:[{wallet:'a',amountRaw:'2000'},{wallet:'b',amountRaw:'1000'}],relationships:[{from:'a',to:'b'}],relationshipCount:1,historyComplete:false,coverageScope:'bounded fixture'};
 const r=practicalAssessmentV2({now,result:{mint},workerEvidence:{mint,version:'1.1',holderRelationships:rel}});
 assert.equal(r.scores.holder_intelligence.metrics.connectedExposurePct,30);
 assert.equal(r.scores.holder_intelligence.metrics.relationshipStatus,'verified_material_relationships');
 assert.equal(r.scores.holder_intelligence.metrics.commonOwnershipEstablished,false);
 assert.equal(r.scores.holder_intelligence.coveragePct,0);
 rel.relationships=[];rel.relationshipCount=0;
 assert.equal(practicalAssessmentV2({now,result:{mint},workerEvidence:{mint,version:'1.1',holderRelationships:rel}}).scores.holder_intelligence.metrics.relationshipStatus,'no_material_relationships_observed_in_bounded_scope');
});
