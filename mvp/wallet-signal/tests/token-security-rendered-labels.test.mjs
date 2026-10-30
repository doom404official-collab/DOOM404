import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {adaptDashboardEvidence} from '../lib/glitchDashboardEvidenceV11.mjs';
const require=createRequire(import.meta.url);
const {transformSync}=require('next/dist/build/swc');
// Compile the actual dashboard and its JSX child with Next's installed compiler.
// Keep ESM imports real so this exercises the production adapter and normalizer.
const dir=await mkdtemp(new URL('./.token-security-render-',import.meta.url));
let Dashboard;
try {
 for(const name of ['HolderBubbleMap','GlitchV11Dashboard']) {
  let source=await readFile(new URL(`../app/${name}.jsx`,import.meta.url),'utf8');
  source=source.replaceAll('"../lib/','"../../lib/').replace('"./HolderBubbleMap"','"./HolderBubbleMap.mjs"');
  const {code}=transformSync(source,{filename:`${name}.jsx`,jsc:{parser:{syntax:'ecmascript',jsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'es6'}});
  await writeFile(`${dir}/${name}.mjs`,code);
 }
 Dashboard=(await import(`${dir}/GlitchV11Dashboard.mjs`)).default;
} finally {await rm(dir,{recursive:true,force:true});}
const mint='So11111111111111111111111111111111111111112';
const active='11111111111111111111111111111111';
const result=fields=>({mint,tokenProgram:'spl-token',authorityDetailsStatus:'available',mintAuthority:null,freezeAuthority:null,...fields});
const render=(r,extensions)=>renderToStaticMarkup(createElement(Dashboard,{result:r,extensions}));
function label(html,name) {
 const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 return html.match(new RegExp(`<span class="g11-kicker">${escaped}</span><strong>(.*?)</strong>`))?.[1];
}
for(const [field,name] of [['mintAuthority','Mint Authority'],['freezeAuthority','Freeze Authority']]) {
 test(`${name}: malformed/missing evidence renders Pending and withholds authority points`,()=>{
  for(const value of [undefined,'',false,true,0,1,{},[],'invalid-key',' 11111111111111111111111111111111 ']) {
   const r=result({[field]:value});
   for(const payload of [r,JSON.parse(JSON.stringify(r))]) {
    const html=render(payload);
    assert.equal(label(html,name),'Pending');
    assert.equal(adaptDashboardEvidence({result:payload}).scores.token_security.score,null);
   }
  }
 });
 test(`${name}: explicit null and canonical address keep their rendered labels`,()=>{
  assert.equal(label(render(result({[field]:null})),name),'Revoked');
  assert.equal(label(render(result({[field]:active})),name),'111111…11111');
 });
}
test('unparsed or missing mint evidence cannot show revoked authorities',()=>{
 for(const r of [undefined,result({authorityDetailsStatus:'not_parsed'}),result({mint:undefined})]) {
  const html=render(r);
  for(const name of ['Mint Authority','Freeze Authority'])assert.equal(label(html,name),'Pending');
 }
});
test('fee configuration label requires an actual reported boolean',()=>{
 const r=result({tokenProgram:'token-2022'});
 for(const reported of [undefined,false,'false',1,{},true]) {
  const extensions={mint,verified:true,observedAt:new Date().toISOString(),transferFee:{status:'observed',configAuthorityReported:reported,configAuthority:null}};
  assert.equal(label(render(r,extensions),'Fee Configuration Authority'),reported===true?'Revoked':'Pending');
 }
});
test('malformed reported fee authority stays Pending and unscored across serialization',()=>{
 const r=result({tokenProgram:'token-2022'});
 for(const authority of [undefined,'',false,true,0,1,{},[],'invalid-key']){
  const extensions={mint,verified:true,observedAt:new Date().toISOString(),transferFee:{status:'observed',configAuthorityReported:true,configAuthority:authority}};
  for(const payload of [extensions,JSON.parse(JSON.stringify(extensions))]){
   assert.equal(label(render(r,payload),'Fee Configuration Authority'),'Pending');
   assert.equal(adaptDashboardEvidence({result:r,extensions:payload}).scores.token_security.components[1].points,null);
  }
 }
});
test('Token Security excludes legacy largest-account rows and weights',()=>{
 const r=result({largestTokenAccountPct:99,largestTokenAccount:{sharePct:99}});
 const adapted=adaptDashboardEvidence({result:r,concentration:{mint,top20TokenAccountSharePct:99}});
 assert.deepEqual(adapted.scores.token_security.components.map(c=>c.id),['transfer_fee_schedule','fee_configuration_authority','mint_authority','freeze_authority']);
 assert.doesNotMatch(render(r),/Largest Token Account/i);
 assert.equal(adapted.scores.token_security.calibrated,false);
});
test('fee labels withhold unknown program/unverified evidence and SPL label alone is not N/A',()=>{
 const extensions={mint,verified:true,observedAt:new Date().toISOString(),transferFee:{status:'observed',configAuthorityReported:true,configAuthority:null}};
 for(const tokenProgram of ['unknown',undefined])for(const field of ['Transfer Fee Schedule','Fee Configuration Authority'])assert.equal(label(render(result({tokenProgram}),extensions),field),'Pending');
 for(const verified of [false,'true',1,undefined])assert.equal(label(render(result({tokenProgram:'token-2022'}),{...extensions,verified}),'Fee Configuration Authority'),'Pending');
 assert.equal(label(render(result({authorityDetailsStatus:'not_parsed'})),'Transfer Fee Schedule'),'Pending');
 assert.equal(label(render(result({})),'Transfer Fee Schedule'),'Not applicable');
});
test('resolved schedule is labelled as observation while numeric scoring stays withheld',()=>{
 const r=result({tokenProgram:'spl-token-2022'}),fee={epoch:'20',basisPoints:200,maximumFeeRaw:'9007199254740993'};
 const extensions={mint,verified:true,observedAt:new Date().toISOString(),epochContext:{epoch:'20',beforeSlot:'100',accountSlot:'101',afterSlot:'102',commitment:'confirmed'},transferFee:{status:'observed',olderFee:fee,newerFee:fee,configAuthorityReported:true,configAuthority:null}};
 const html=render(r,extensions);assert.equal(label(html,'Transfer Fee Schedule'),'2%');assert.match(html,/Transfer behavior not verified; scoring pending/);assert.equal(adaptDashboardEvidence({result:r,extensions}).scores.token_security.components[0].points,null);
 for(const basisPoints of [-1,NaN,Infinity,'invalid']){const malformed={...extensions,transferFee:{...extensions.transferFee,newerFee:{...fee,basisPoints}}};assert.equal(label(render(r,malformed),'Transfer Fee Schedule'),'Pending');}
});
