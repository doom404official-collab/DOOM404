import test from 'node:test';
import assert from 'node:assert/strict';
import {assessmentDisplay,holderSampleLabel} from '../lib/evidenceHudPresentation.mjs';
import {investigateToken} from '../lib/boundedTokenInvestigation.mjs';
import {publicInvestigation,createTokenInvestigationStore} from '../lib/tokenInvestigationStore.mjs';
import {practicalAssessmentV2} from '../lib/practicalScoringV2.mjs';
const mint='EMQGeopasoZZUqiPDErvSL1QqvGr5WfZ1hbcvmAf8C3Y';
test('unassessed gauges have no marker; assessed zero remains a numeric zero',()=>{
 const a={coveragePct:40,scores:{token_security:{coveragePct:100,riskScore:0},liquidity_quality_safety:{coveragePct:0,riskScore:0}},riskScore:0};
 assert.deepEqual(assessmentDisplay(a,'liquidity_quality_safety'),{assessed:false,coverage:0,score:null,label:'Not assessed'});
 assert.equal(assessmentDisplay(a,'overall').score,null);
 assert.equal(assessmentDisplay(a,'token_security').score,0);
 assert.equal(holderSampleLabel(18),'Sampled 18 wallets');
});
test('expired or absent durable workers never remain indefinitely pending',()=>{
 assert.equal(publicInvestigation(null).status,'evidence_unavailable');
 assert.equal(publicInvestigation({status:'running',lease_until:'2020-01-01'}).reason,'bounded_execution_interrupted');
 assert.equal(publicInvestigation({status:'running',lease_until:'2099-01-01'}).status,'assessment_in_progress');
});
test('a new unsupported token finishes without inventing attribution or independence',async()=>{
 const calls=[];const r=await investigateToken({mint,rpc:async(method)=>{calls.push(method);if(method==='getTransactionsForAddress')return {data:[]};if(method==='getTokenLargestAccounts')return {value:[]};throw Error('unexpected');}});
 assert.equal(r.status,'investigation_completed');assert.equal(r.creator.status,'unsupported_protocol');assert.equal(r.holderRelationships,null);assert.equal(r.historyComplete,false);assert.equal(r.execution.requests,2);assert.deepEqual(calls,['getTransactionsForAddress','getTokenLargestAccounts']);
});
test('provider method failures are distinct from unsupported protocol',async()=>{
 const r=await investigateToken({mint,rpc:async()=>{const e=Error('unsupported');e.code=-32601;throw e;}});
 assert.equal(r.creator.status,'provider_temporarily_unavailable');assert.equal(r.execution.failures[0].reason,'indexed_method_unsupported');assert.ok(r.execution.requests<=18);
});
test('store never reports success for a rejected CAS finish',async()=>{
 const store=createTokenInvestigationStore({env:{SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test'},fetchImpl:async()=>Response.json(false)});
 await assert.rejects(store.finish(mint,'owner',{mint}),/UNCONFIRMED/);
});
test('new evidence does not reweight categories or turn missing criteria into safety',()=>{
 const r=practicalAssessmentV2({result:{mint,tokenProgram:'spl-token',authorityDetailsStatus:'available',mintAuthority:null,freezeAuthority:null}});
 assert.equal(r.scores.liquidity_quality_safety.coveragePct,0);
 assert.equal(r.coveragePct,Object.values(r.scores).reduce((n,a)=>n+a.coveragePct,0)/4);
 assert.equal(r.riskScore,Object.values(r.scores).reduce((n,a)=>n+a.riskScore,0)/4);
});

test('an empty fresh-token pass preserves accepted historical creator events',async()=>{
 const {readFileSync}=await import('node:fs');
 const {readDashboardEvidence,projectCreatorCheckpoint}=await import('../lib/dashboardEvidenceBridge.mjs');
 const fixture=JSON.parse(readFileSync(new URL('./fixtures/creator-observed-behaviour-v2.json',import.meta.url)));
 const row={mint:fixture.mint,status:'partial',stage:'selling',state:{originEvidence:[{creator:fixture.creator}],practicalScoringEvidenceV2:fixture}};
 const prior=projectCreatorCheckpoint(row,fixture.mint).behaviourV2;
 const observation={mint:fixture.mint,status:'investigation_completed',creator:{creator:fixture.creator,attribution:{mint:fixture.mint,creator:fixture.creator,verified:true,verification:'transaction_local_protocol_creator'},events:[],behaviourV2:{processedHistoricalSignatures:0}}};
 const out=await readDashboardEvidence({mint:fixture.mint,url:'https://fixture.supabase.co',key:'test',fetchImpl:async url=>({ok:true,json:async()=>url.includes('creator_intelligence_jobs')?[row]:url.includes('scanner_token_investigations')?[{status:'complete',expires_at:'2099-01-01',observation}]:[]})});
 assert.deepEqual(out.creator.behaviourV2.ledger,prior.ledger);
 assert.ok(prior.ledger.acceptedCount>0);
});
