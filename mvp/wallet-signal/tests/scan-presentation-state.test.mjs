import test from 'node:test';
import assert from 'node:assert/strict';
import {scanPresentationState} from '../lib/scanPresentationState.mjs';
test('all seven states separate progress from terminal evidence qualification',()=>{
 const cases=[
  [{progress:{stage:'initializing'}},'initializing'],
  [{progress:{stage:'initial_in_progress'}},'collecting_evidence'],
  [{progress:{stage:'deep_in_progress'},hasEvidence:true},'assessment_in_progress'],
  [{progress:{stage:'bounded_complete'},assessed:true,complete:true},'complete'],
  [{progress:{stage:'bounded_complete'},assessed:true},'complete_partial'],
  [{progress:{stage:'bounded_complete'}},'complete_insufficient'],
  [{progress:{stage:'bounded_stopped'},assessed:true},'interrupted']
 ];for(const [input,state] of cases)assert.equal(scanPresentationState(input).state,state);
});
test('DCTY initial-to-final transition never calls active evidence insufficient',()=>{
 const first=scanPresentationState({progress:{stage:'deep_in_progress'},hasEvidence:true});
 assert.equal(first.riskLabel,'Calculating risk…');assert.equal(first.supporting,'Collecting token intelligence.');assert.doesNotMatch(first.status,/insufficient|complete/i);
 const interim=scanPresentationState({progress:{stage:'deep_in_progress'},hasEvidence:true,assessed:true});assert.equal(interim.provisional,true);
 const final=scanPresentationState({progress:{stage:'bounded_complete'},hasEvidence:true,assessed:true});assert.equal(final.provisional,false);assert.equal(final.status,'Scan complete · Some evidence remains unverified.');
});
test('interrupted reports are not labelled scan complete or active',()=>{
 const r=scanPresentationState({progress:{stage:'bounded_stopped'},assessed:true});assert.equal(r.active,false);assert.doesNotMatch(r.status,/complete/i);assert.match(r.status,/interrupted/i);
});

test('active gauge renders calculating wording, then provisional number, then terminal qualification',async()=>{
 const {createElement}=await import('react'),{renderToStaticMarkup}=await import('react-dom/server'),{loadJSX}=await import('./helpers/render-jsx.mjs');
 const {RiskGauge}=loadJSX(new URL('../app/TokenIntelligenceHUD.jsx',import.meta.url));
 const html=renderToStaticMarkup(createElement(RiskGauge,{display:{assessed:false,score:null},scanState:scanPresentationState({progress:{stage:'deep_in_progress'},hasEvidence:true})}));
 assert.match(html,/Calculating risk…/);assert.match(html,/Collecting token intelligence/);assert.doesNotMatch(html,/Insufficient evidence|Not assessed/);
 const provisional=renderToStaticMarkup(createElement(RiskGauge,{display:{assessed:true,score:13.8,coverage:65.5},scanState:scanPresentationState({progress:{stage:'deep_in_progress'},assessed:true,hasEvidence:true})}));
 assert.match(provisional,/13.8/);assert.match(provisional,/Provisional observed risk/);
 const complete=renderToStaticMarkup(createElement(RiskGauge,{display:{assessed:false,score:null},scanState:scanPresentationState({progress:{stage:'bounded_complete'}})}));assert.match(complete,/Insufficient evidence/);
});

test('active overview attributes distinguish pending evidence from terminal insufficiency',async()=>{
 const {createElement}=await import('react'),{renderToStaticMarkup}=await import('react-dom/server'),{loadJSX}=await import('./helpers/render-jsx.mjs'),{practicalAssessmentV2}=await import('../lib/practicalScoringV2.mjs'),{replay}=await import('./fixtures/ui-assessment-replay.mjs');
 const {RiskOverview}=loadJSX(new URL('../app/TokenIntelligenceHUD.jsx',import.meta.url));const r=replay(),assessment=practicalAssessmentV2({result:r.result});
 const html=renderToStaticMarkup(createElement(RiskOverview,{assessment,scanState:scanPresentationState({progress:{stage:'deep_in_progress'},hasEvidence:true}),onSelect:()=>{}}));assert.match(html,/Collecting evidence/);assert.doesNotMatch(html,/Insufficient evidence/);assert.match(html,/Provisional assessment/);
});
