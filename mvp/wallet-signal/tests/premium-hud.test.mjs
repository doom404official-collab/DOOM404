import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadJSX} from './helpers/render-jsx.mjs';
const {RiskGauge,CoverageGauge}=loadJSX(new URL('../app/TokenIntelligenceHUD.jsx',import.meta.url));
test('premium gauge data arcs retain proportional geometry and withhold unavailable readings',()=>{
 for(const n of [0,25,50,75,100]){
  const risk=renderToStaticMarkup(createElement(RiskGauge,{display:{assessed:true,score:n}}));
  const coverage=renderToStaticMarkup(createElement(CoverageGauge,{value:n}));
  for(const [html,kind] of [[risk,'risk'],[coverage,'coverage']]){
   assert.match(html,new RegExp(`data-gauge="${kind}" data-value="${n}"`));
   assert.match(html,new RegExp(`stroke-dasharray="${n} 100"`));
   assert.match(html,/pathLength="100"/);
  }
 }
 const risk=renderToStaticMarkup(createElement(RiskGauge,{display:{assessed:false,label:'Not assessed',score:0}}));
 assert.doesNotMatch(risk,/data-gauge="risk"/);assert.match(risk,/Not assessed/);
 const missing=renderToStaticMarkup(createElement(CoverageGauge,{value:null}));
 assert.doesNotMatch(missing,/data-gauge="coverage"/);assert.match(missing,/coverage unavailable/);
});
