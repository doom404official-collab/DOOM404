import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {replay} from './fixtures/ui-assessment-replay.mjs';
const require=createRequire(import.meta.url),{transformSync}=require('next/dist/build/swc');
const dir=await mkdtemp(new URL('./.ui-dashboard-',import.meta.url));let Dashboard;
try{
 for(const name of ['EvidenceHUD','HolderBubbleMap','PracticalAssessmentPanel','GlitchV11Dashboard']){
  let source=await readFile(new URL(`../app/${name}.jsx`,import.meta.url),'utf8');
  source=source.replaceAll("'../lib/","'../../lib/").replace('"./EvidenceHUD"','"./EvidenceHUD.mjs"');
  source=source.replaceAll('"../lib/','"../../lib/').replace('"./HolderBubbleMap"','"./HolderBubbleMap.mjs"').replace('"./PracticalAssessmentPanel"','"./PracticalAssessmentPanel.mjs"');
  const {code}=transformSync(source,{filename:name+'.jsx',jsc:{parser:{syntax:'ecmascript',jsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'es6'}});
  await writeFile(`${dir}/${name}.mjs`,code);
 }
 Dashboard=(await import(`${dir}/GlitchV11Dashboard.mjs`)).default;
}finally{await rm(dir,{recursive:true,force:true});}
test('each dashboard tab renders exactly one consolidated disclaimer after optional controls',()=>{
 // Selection is client state. The shared footer must live outside the selected panel.
 const props=replay(),html=renderToStaticMarkup(createElement(Dashboard,{...props,liquidity:props.reportedLiquidity},createElement('details',{className:'doom-token-tools'},'Optional creator history investigation')));
 assert.equal((html.match(/class="g11-disclaimer"/g)||[]).length,1);
 assert.equal((html.match(/not financial advice/g)||[]).length,1);
 assert.ok(html.indexOf('Optional creator history investigation')<html.indexOf('class="g11-disclaimer"'));
 assert.match(html,/<footer class="g11-disclaimer"><p>GLITCH Scanner provides evidence-based risk assessments/);
 assert.match(html,/<\/footer><\/section>$/);
});
test('persistent token identity and original mascot remain available with absent mint evidence',()=>{
 const html=renderToStaticMarkup(createElement(Dashboard,{}));
 assert.match(html,/Insufficient evidence/);assert.match(html,/Not established/);
 assert.match(html,/DOOM404 official red-hooded robot mascot/);
 assert.match(html,/aria-label="Copy full mint address"/);
 assert.equal((html.match(/not financial advice/g)||[]).length,1);
});
