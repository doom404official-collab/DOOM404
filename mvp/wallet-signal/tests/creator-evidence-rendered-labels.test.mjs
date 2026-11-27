import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {adaptDashboardEvidence} from '../lib/glitchDashboardEvidenceV11.mjs';
import {projectCreatorCheckpoint} from '../lib/dashboardEvidenceBridge.mjs';
import {summarizeCreatorAcquisitionLedger} from '../lib/creatorAcquisitionLedger.mjs';
const require=createRequire(import.meta.url);
const {transformSync}=require('next/dist/build/swc');
// Compile the actual dashboard and its JSX child with Next's installed compiler.
// Keep ESM imports real so this exercises the production adapter and normalizer.
const dir=await mkdtemp(new URL('./.creator-evidence-render-',import.meta.url));
let Dashboard;
try {
 for(const name of ['TokenIntelligenceHUD','EvidenceHUD','HolderBubbleMap','PracticalAssessmentPanel','GlitchV11Dashboard']) {
  let source=await readFile(new URL(`../app/${name}.jsx`,import.meta.url),'utf8');
  source=source.replaceAll("'../lib/","'../../lib/").replace('"./EvidenceHUD"','"./EvidenceHUD.mjs"').replace('"./TokenIntelligenceHUD"','"./TokenIntelligenceHUD.mjs"');
  source=source.replaceAll('"../lib/','"../../lib/').replace('"./TokenIntelligenceHUD"','"./TokenIntelligenceHUD.mjs"').replace('"./HolderBubbleMap"','"./HolderBubbleMap.mjs"').replace('"./PracticalAssessmentPanel"','"./PracticalAssessmentPanel.mjs"');
  // Static label fixtures select Creator Intelligence; real default/navigation is browser-tested.
  if(name==='GlitchV11Dashboard'){
   assert.ok(source.includes('useState("overall")'));
   source=source.replace('useState("overall")','useState("creator_intelligence")');
  }
  const {code}=transformSync(source,{filename:`${name}.jsx`,jsc:{parser:{syntax:'ecmascript',jsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'es6'}});
  await writeFile(`${dir}/${name}.mjs`,code);
 }
 Dashboard=(await import(`${dir}/GlitchV11Dashboard.mjs`)).default;
} finally {await rm(dir,{recursive:true,force:true});}

// Synthetic checkpoint evidence, never authentic allocation or transfer proof.
const mint='So11111111111111111111111111111111111111112',creator='11111111111111111111111111111111';
function fixture(){
 const updatedAt=new Date().toISOString();
 const events=[{mint,creator,signature:'synthetic-launch',instructionIndex:0,innerInstructionIndex:null,type:'LAUNCH_DISTRIBUTION',amountRaw:'100',timestamp:100,independentlyVerified:true,instructionVerified:true,launchInstructionVerified:true}];
 const state={originEvidence:[{creator}],holdings:{mint,creator,status:'ONCHAIN_BALANCE_OBSERVED',supplySharePct:0,balanceObservedAt:updatedAt},previousLaunches:{attributedLaunchCount:0},creatorHistoryComplete:true,creatorAcquisitionAttributionComplete:true,creatorVerifiedAcquisitionEvents:events,
  creatorAcquisitionLedger:summarizeCreatorAcquisitionLedger({mint,creator,events,historyComplete:true,attributionComplete:true}),
  initialAllocationEvidence:{status:'INITIAL_ALLOCATION_EVIDENCE_COMPLETE',coverageComplete:true,initialAttributableRaw:'100'},
  selling:{methodology:'CREATOR_SELLING_V1_1',creatorSellingScoreEligible:true,windows:[3600,86400,604800].map(seconds=>({seconds,historyComplete:true,scoreEligible:true,verifiedSoldRaw:'0',sellThroughPct:0}))}};
 return {mint,status:'partial',stage:'selling',updated_at:updatedAt,state};
}
function props(row){return {result:{mint},creatorEvidence:{mint,creator,status:'VERIFIED',independentlyReviewed:true},workerEvidence:{version:'1.1',mint,creator:projectCreatorCheckpoint(row,mint)}};}
const render=p=>renderToStaticMarkup(createElement(Dashboard,p));
const label=(html,name)=>html.match(new RegExp('<span class="g11-kicker">'+name+'</span><strong>(.*?)</strong>'))?.[1];
function pendingScore(html){assert.match(html,/Limited assessment:/);assert.match(html,/Assessed points:/);assert.match(html,/incomplete/);}
test('projected numeric zeros render as observations and eligible selling, never a final score',()=>{
 const p=props(fixture()),html=render(p);
 assert.equal(label(html,'Creator Holdings'),'0% observed');
 assert.equal(label(html,'Previous Launches'),'0 attributed launches');
 assert.equal(label(html,'Creator Selling'),'0% / 0% / 0%');
 assert.equal(adaptDashboardEvidence(p).scores.creator_intelligence.components[2].points,30);
 pendingScore(html);
});
test('incomplete or conflicting projected selling renders Pending rather than zero sales',()=>{
 const changes=[s=>s.creatorHistoryComplete=false,s=>s.initialAllocationEvidence.coverageComplete=false,s=>s.selling.windows.pop(),s=>s.selling.windows.push({...s.selling.windows[0]}),s=>s.selling.windows[0].sellThroughPct=1,s=>s.creatorAcquisitionLedger.verifiedSoldRaw='1'];
 for(const change of changes){const row=fixture();change(row.state);const p=props(row),html=render(p);
  assert.equal(p.workerEvidence.creator.selling,null);
  assert.equal(label(html,'Creator Selling'),'Pending');
  assert.equal(adaptDashboardEvidence(p).scores.creator_intelligence.components[2].points,null);
  pendingScore(html);
 }
});
test('malformed projected observation counts cannot render numerical zeros',()=>{
 for(const value of [null,false,'',-1]){const row=fixture();row.state.holdings.supplySharePct=value;row.state.previousLaunches.attributedLaunchCount=value;const html=render(props(row));
  assert.equal(label(html,'Creator Holdings'),'Pending');assert.equal(label(html,'Previous Launches'),'Pending');pendingScore(html);
 }
});
test('foreign identity, stale evidence and nonliteral review cannot expose eligible selling labels',()=>{
 for(const mutate of [p=>p.workerEvidence.creator.mint='other',p=>p.workerEvidence.creator.creator='other',p=>p.workerEvidence.creator.updatedAt='2020-01-01T00:00:00Z',p=>p.creatorEvidence.independentlyReviewed='true']){
  const p=props(fixture());mutate(p);const html=render(p);
  for(const name of ['Creator Holdings','Creator Selling','Previous Launches'])assert.equal(label(html,name),'Pending');
  assert.equal(adaptDashboardEvidence(p).scores.creator_intelligence.components[2].points,null);pendingScore(html);
 }
});
