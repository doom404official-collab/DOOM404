import {loadJSX} from './helpers/render-jsx.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {practicalAssessmentV2} from '../lib/practicalScoringV2.mjs';
import {replay} from './fixtures/ui-assessment-replay.mjs';
const Panel=loadJSX(new URL('../app/PracticalAssessmentPanel.jsx',import.meta.url)).default;
const render=(assessment,selected='overall')=>renderToStaticMarkup(createElement(Panel,{assessment,selected,onSelect:()=>{}}));
test('scoreboard precedes selectable attributes, insights and flags without mutating evidence',()=>{
 const args=replay(),before=structuredClone(args),assessment=practicalAssessmentV2(args),scores=structuredClone(assessment),html=render(assessment);
 assert.equal(assessment.coveragePct,82.5);assert.equal(assessment.riskScore,12.15);
 assert.ok(html.indexOf('Overall assessment')<html.indexOf('Attribute score summary'));
 assert.ok(html.indexOf('Attribute score summary')<html.indexOf('Three important insights'));
 assert.ok(html.indexOf('Three important insights')<html.indexOf('Prioritized risk flags'));
 assert.equal((html.match(/class="g11-attribute-card"/g)||[]).length,4);
 assert.match(html,/Partial assessment/);assert.match(html,/82.5%/);
 assert.deepEqual(args,before);assert.deepEqual(assessment,scores);
});
test('all four material flags survive compact presentation and retain unresolved classification',()=>{
 const html=render(practicalAssessmentV2(replay()));
 for(const text of ['Protocol administrator retains operation controls','Liquidity concentrated in one reported pool','Creator fee-recipient mismatch; authorization unresolved','Material creator transfers; recipient ownership unresolved'])assert.ok(html.includes(text),text);
 assert.doesNotMatch(html,/EVIDENCE \/ CONTROL|confirmed malicious|BUY|SELL|SAFE/);
});
test('all ten criterion names are readable and their risk points match each engine result',()=>{
 const assessment=practicalAssessmentV2(replay());
 for(const [selected,a] of Object.entries(assessment.scores)){
  const html=render(assessment,selected);
  assert.equal(Math.round(a.components.reduce((sum,c)=>sum+c.riskPoints,0)*100)/100,a.riskScore);
  assert.match(html,/Evidence available|Limited evidence/);
  assert.doesNotMatch(html,/Partial or unavailable; no safety credit|Criterion observed/);
 }
 assert.match(render(assessment,'token_security'),/Minting risk/);
 assert.match(render(assessment,'holder_intelligence'),/Connected wallet exposure/);
 assert.match(render(assessment,'liquidity_quality_safety'),/Liquidity backing/);
 assert.match(render(assessment,'creator_intelligence'),/Creator sales and transfers/);
});
test('critical warnings open by default while no new score severity thresholds are introduced',()=>{
 const a=practicalAssessmentV2(replay());a.flags.unshift({id:'reference_exit_unavailable',severity:'critical',detail:'Reference sale unavailable.'});
 const html=render(a);assert.match(html,/g11-flag--critical" open=""/);assert.match(html,/Critical risk/);assert.match(html,/Reference sale unavailable/);
 assert.match(html,/Higher risk →/);assert.doesNotMatch(html,/Low risk|Medium risk|High risk|safe rating/);
});
test('sparse evidence stays visibly incomplete and generic disclaimers do not repeat in panels',()=>{
 const a=practicalAssessmentV2({result:{mint:replay().result.mint}});
 for(const selected of ['overall',...Object.keys(a.scores)]){
  const html=render(a,selected);assert.match(html,/Not assessed/);assert.doesNotMatch(html,/class="g11-risk-scale"/);
  assert.doesNotMatch(html,/does not guarantee safety|Unobserved risk may be higher|not a safety rating|not financial advice/);
 }
 assert.match(render(a),/Not assessed/);
});
