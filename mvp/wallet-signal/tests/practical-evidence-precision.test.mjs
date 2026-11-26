import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url),{transformSync}=require('next/dist/build/swc');
const {code}=transformSync(fs.readFileSync(new URL('../app/PracticalAssessmentPanel.jsx',import.meta.url),'utf8'),{filename:'panel.jsx',jsc:{parser:{syntax:'ecmascript',jsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
const ctx={exports:{},require};vm.runInNewContext(code,ctx);const Panel=ctx.exports.default;
test('small verified LP claims are not rounded into a false zero-withdrawal claim',()=>{
 const a={riskScore:10,coveragePct:100,flags:[],missing:[],components:[],metrics:{maxCurrentWithdrawalPct:0.003645,quotes:[]}},empty={metrics:{}};
 const assessment={flags:[],unresolved:[],scores:{token_security:empty,holder_intelligence:empty,liquidity_quality_safety:a,creator_intelligence:empty}};
 const html=renderToStaticMarkup(createElement(Panel,{assessment,selected:'liquidity_quality_safety'}));assert.match(html,/0\.003645%/);assert.doesNotMatch(html,/maximum claim: 0%/);
});
