import {loadJSX} from './helpers/render-jsx.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const Panel=loadJSX(new URL('../app/PracticalAssessmentPanel.jsx',import.meta.url)).default;
test('small verified LP claims are not rounded into a false zero-withdrawal claim',()=>{
 const a={riskScore:10,coveragePct:100,flags:[],missing:[],components:[],metrics:{maxCurrentWithdrawalPct:0.003645,quotes:[]}},empty={metrics:{}};
 const assessment={flags:[],unresolved:[],scores:{token_security:empty,holder_intelligence:empty,liquidity_quality_safety:a,creator_intelligence:empty}};
 const html=renderToStaticMarkup(createElement(Panel,{assessment,selected:'liquidity_quality_safety'}));assert.match(html,/0\.003645%/);assert.doesNotMatch(html,/maximum claim: 0%/);
});

test('unexecutable reference sale is not rendered as an invented 100-percent fill cost',()=>{
 const a={riskScore:50,coveragePct:100,flags:[],missing:[],components:[],metrics:{quotes:[{referenceNotional:1,quoteSymbol:'SOL'},{referenceNotional:10,quoteSymbol:'SOL'},{referenceNotional:100,quoteSymbol:'SOL',impactIncludingFeesPct:null,executable:false}]}},empty={metrics:{}};const assessment={flags:[],unresolved:[],scores:{token_security:empty,holder_intelligence:empty,liquidity_quality_safety:a,creator_intelligence:empty}};
 assert.match(renderToStaticMarkup(createElement(Panel,{assessment,selected:'liquidity_quality_safety'})),/Unavailable under the observed pool state/);assert.doesNotMatch(renderToStaticMarkup(createElement(Panel,{assessment,selected:'overall'})),/100% including/);
});

test('quote recovery is labelled separately and critical controls precede noncritical warnings',()=>{
 const a={riskScore:20,coveragePct:50,flags:[{id:'high',severity:'high',detail:'Ordinary evidence limitation'},{id:'critical',severity:'critical',detail:'Decisive exit warning'}],missing:[],components:[],metrics:{quotes:[{referenceNotional:1,quoteSymbol:'SOL'},{referenceNotional:10,quoteSymbol:'SOL'},{referenceNotional:100,quoteSymbol:'SOL',measurement:'reference_quote_recovery',quoteRecoveryShortfallPct:8}]}},empty={metrics:{}};const assessment={flags:[],unresolved:[],scores:{token_security:empty,holder_intelligence:empty,liquidity_quality_safety:a,creator_intelligence:empty}},html=renderToStaticMarkup(createElement(Panel,{assessment,selected:'liquidity_quality_safety'}));
 assert.match(html,/quoted SOL recovery shortfall/);assert.ok(html.indexOf('Decisive exit warning')<html.indexOf('Ordinary evidence limitation'));
});

test('overall puts three insights before expandable risk detail without hiding critical headlines',()=>{
 const empty={riskScore:0,coveragePct:100,metrics:{}},flag={id:'reference_exit_unavailable',severity:'critical',detail:'A defined reference sale cannot be funded.'},assessment={riskScore:20,coveragePct:80,complete:false,flags:[flag],unresolved:[],scores:{token_security:empty,holder_intelligence:empty,liquidity_quality_safety:empty,creator_intelligence:empty}},html=renderToStaticMarkup(createElement(Panel,{assessment,selected:'overall'}));assert.ok(html.indexOf('Attribute-wise Risk Score')<html.indexOf('Risks Identified'));assert.match(html,/<article[^>]*role="alert"/);assert.ok(html.indexOf('A defined reference sale cannot be funded.')<html.indexOf('View supporting evidence'));assert.match(html,/<p>A defined reference sale cannot be funded\.<\/p>/);
});

