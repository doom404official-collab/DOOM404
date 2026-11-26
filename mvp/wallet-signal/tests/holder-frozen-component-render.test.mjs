import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {assessApprovedHolderEligibleConcentration,HOLDER_RETAIN19_POLICY as policy} from '../lib/holderEligibleViewPolicy.mjs';
const require=createRequire(import.meta.url);
const {transformSync}=require('next/dist/build/swc');
// Compile the actual dashboard and its JSX child with Next's installed compiler.
// Keep ESM imports real so this exercises the production adapter and normalizer.
const dir=await mkdtemp(new URL('./.holder-component-render-',import.meta.url));
let Dashboard;
try {
 for(const name of ['HolderBubbleMap','PracticalAssessmentPanel','GlitchV11Dashboard']) {
  let source=await readFile(new URL(`../app/${name}.jsx`,import.meta.url),'utf8');
  source=source.replaceAll('"../lib/','"../../lib/').replace('"./HolderBubbleMap"','"./HolderBubbleMap.mjs"').replace('"./PracticalAssessmentPanel"','"./PracticalAssessmentPanel.mjs"');
  // Static label fixtures select Holder Intelligence; real default/navigation is browser-tested.
  if(name==='GlitchV11Dashboard'){
   assert.ok(source.includes('useState("overall")'));
   source=source.replace('useState("overall")','useState("holder_intelligence")');
  }
  const {code}=transformSync(source,{filename:`${name}.jsx`,jsc:{parser:{syntax:'ecmascript',jsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'es6'}});
  await writeFile(`${dir}/${name}.mjs`,code);
 }
 Dashboard=(await import(`${dir}/GlitchV11Dashboard.mjs`)).default;
} finally {await rm(dir,{recursive:true,force:true});}

// Synthetic permitted snapshot fixture; authentic retained rows stay private.
const snapshot={id:policy.snapshotId,mint:policy.mint,slot:policy.slot,status:'frozen',supply_raw:'1000',excluded_wallets:['1nc1nerator11111111111111111111111111111111'],holder_ranking:[policy.infrastructurePool,...Array.from({length:19},(_,i)=>'2'.repeat(31)+'123456789ABCDEFGHJKLMNPQRSTUVWXYZ'[i])].map(wallet=>({wallet,balance:'10'}))};
const observation=()=>assessApprovedHolderEligibleConcentration(snapshot);
const render=(value,mint=policy.mint)=>renderToStaticMarkup(createElement(Dashboard,{result:{mint,authorityDetailsStatus:'not_parsed'},frozenHolderObservation:value}));
test('approved observed component renders on its own denominator with unchanged warnings',()=>{
 const o=observation(),html=render(o);
 assert.equal(o.component.points,32.2);
 assert.match(html,/Observed eligible-holder concentration component: 32.2\/35/);
 assert.match(html,/Component only — not a Holder or Overall score/);
 assert.match(html,/Snapshot #2 at slot 457305617/);
 assert.match(html,/Exact-slot account-state certification and historical-job association remain unverified; final score remains Pending/);
 assert.match(html,/Limited assessment:/);
});
test('absent, foreign or malformed component is not displayed as numerical evidence',()=>{
 const cases=[null,{...observation(),snapshotId:'foreign'},{...observation(),policy:{id:'foreign'}},{...observation(),eligibilityPolicy:'foreign'},{...observation(),calibrated:true},{...observation(),scorePromoted:true},{...observation(),finalScore:100}];
 for(const points of [null,false,'32.2',NaN,Infinity,-1,36])cases.push({...observation(),component:{...observation().component,points}});
 for(const change of [{id:'foreign'},{max:100},{status:'verified'}])cases.push({...observation(),component:{...observation().component,...change}});
 for(const value of cases){const html=render(value);assert.doesNotMatch(html,/data-testid="frozen-concentration-component"/);assert.match(html,/Limited assessment:/);}
 assert.doesNotMatch(render(observation(),'7'.repeat(32)),/data-testid="frozen-concentration-component"/);
});

test('serialized or forged lineage flags cannot render verified collection lineage',()=>{
 for(const collectionLineage of [undefined,{status:'verified',canonicalRowHashVerified:true,snapshotId:policy.snapshotId,runId:'38769967061'},true]){
  const html=render({...observation(),collectionLineage});
  assert.match(html,/Collection lineage unverified/);assert.doesNotMatch(html,/data-testid="frozen-collection-lineage"/);
  assert.match(html,/Limited assessment:/);
 }
});
