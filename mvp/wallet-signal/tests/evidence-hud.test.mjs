import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadJSX} from './helpers/render-jsx.mjs';
import {formatTokenQuantity,exitQuoteValue} from '../lib/evidenceHudPresentation.mjs';
import {practicalAssessmentV2} from '../lib/practicalScoringV2.mjs';
import {replay} from './fixtures/ui-assessment-replay.mjs';
const HUD=loadJSX(new URL('../app/EvidenceHUD.jsx',import.meta.url)).default;
test('token units preserve exact quantities for zero, nine and nonstandard decimals',()=>{
 assert.equal(formatTokenQuantity('156640000000000000',9),'156.64M');
 assert.equal(formatTokenQuantity('12345678901234567890',9,false),'12,345,678,901.23456789');
 assert.equal(formatTokenQuantity('0',9),'0');assert.equal(formatTokenQuantity('123',0,false),'123');
 assert.equal(formatTokenQuantity('123',undefined),'Not assessed');assert.equal(formatTokenQuantity(null,6),'Not assessed');
 assert.equal(formatTokenQuantity('1',12),'0.000000…');
});
test('zero exit cost differs from absent and unexecutable quotes',()=>{
 assert.equal(exitQuoteValue({impactIncludingFeesPct:0}),0);assert.equal(exitQuoteValue({}),null);
 assert.equal(exitQuoteValue({executable:false,impactIncludingFeesPct:100}),null);
});
test('all four HUDs consume evidence without mutating assessments or inventing graph nodes',()=>{
 const args=replay(),a=practicalAssessmentV2(args),before=structuredClone(a);
 for(const selected of Object.keys(a.scores)){
 const html=renderToStaticMarkup(createElement(HUD,{assessment:a,selected,decimals:args.result.decimals}));
 assert.match(html,/Evidence Intelligence/);assert.doesNotMatch(html,/NaN|undefined|Infinity/);
 }
 const holders=renderToStaticMarkup(createElement(HUD,{assessment:a,selected:'holder_intelligence'}));
 assert.match(holders,/Top-20 concentration/);assert.doesNotMatch(holders,/independently owned|wallet-node/);
 assert.deepEqual(a,before);
});
test('missing and partial evidence does not become verified or green status',()=>{
 const a=practicalAssessmentV2({});for(const selected of Object.keys(a.scores)){
 const html=renderToStaticMarkup(createElement(HUD,{assessment:a,selected}));assert.doesNotMatch(html,/Verified absence|Safe|#36D5A0/);
 }assert.match(renderToStaticMarkup(createElement(HUD,{assessment:a,selected:'creator_intelligence'})),/Creator not established · Creator attribution evidence inconclusive/);
});
test('HUD components introduce no network or heavy visualization dependencies',()=>{
 const code=fs.readFileSync(new URL('../app/EvidenceHUD.jsx',import.meta.url),'utf8')+fs.readFileSync(new URL('../lib/evidenceHudPresentation.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(code,/\bfetch\s*\(|XMLHttpRequest|WebSocket|@solana|from\s*['"][^'"]*(?:helius|alchemy|three|chart\.js)/);
});
