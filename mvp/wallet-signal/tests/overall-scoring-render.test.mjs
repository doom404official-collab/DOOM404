import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readDashboardEvidence} from '../lib/dashboardEvidenceBridge.mjs';
import {adaptDashboardEvidence} from '../lib/glitchDashboardEvidenceV11.mjs';
import {consolidate} from '../lib/glitchScoringV11.mjs';
const require=createRequire(import.meta.url),{transformSync}=require('next/dist/build/swc');
const dir=await mkdtemp(new URL('./.overall-render-',import.meta.url));let Dashboard;
try{for(const name of ['HolderBubbleMap','GlitchV11Dashboard']){let source=await readFile(new URL(`../app/${name}.jsx`,import.meta.url),'utf8');source=source.replaceAll('"../lib/','"../../lib/').replace('"./HolderBubbleMap"','"./HolderBubbleMap.mjs"');const {code}=transformSync(source,{filename:name+'.jsx',jsc:{parser:{syntax:'ecmascript',jsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'es6'}});await writeFile(`${dir}/${name}.mjs`,code);}Dashboard=(await import(`${dir}/GlitchV11Dashboard.mjs`)).default;}finally{await rm(dir,{recursive:true,force:true});}
const mint='1'.repeat(32),creator='2'.repeat(32),now='2026-10-29T10:00:00Z';
const result={mint,tokenProgram:'spl-token',authorityDetailsStatus:'available',mintAuthority:null,freezeAuthority:null};
const route=(await readFile(new URL('../app/api/scoring-evidence/route.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replace('export const dynamic','const dynamic').replace('export async function GET','async function GET').replaceAll('process.env.SUPABASE_URL',"'https://synthetic.invalid'").replaceAll('process.env.SUPABASE_SERVICE_ROLE_KEY',"'synthetic-only'");
function api(fetchImpl){return new Function('NextResponse','readDashboardEvidence',route+';return GET;')({json:(body,options)=>({body,...options})},args=>readDashboardEvidence({...args,fetchImpl}));}
test('actual GET projections, adapters and JSX withhold fabricated complete scores and stale provenance',async()=>{
 for(const stale of [false,true])for(const reviewed of [true,false,'true',1]){
  const updatedAt=stale?'2000-01-01T00:00:00Z':now;
  const raw={mint,updated_at:updatedAt,state:{originEvidence:[{creator}],complete:true,calibrated:true,score:100,creatorHistoryComplete:'true'}};
  const baseline=structuredClone(raw),calls=[];
  const GET=api(async(url,o)=>{calls.push(o);return {ok:true,json:async()=>url.includes('creator_intelligence_jobs')?[raw]:[]};});
  const response=await GET(new Request('https://example.invalid/api/scoring-evidence?mint='+mint));
  assert.equal(response.headers['Cache-Control'],'no-store');assert.equal(calls.length,2);assert.ok(calls.every(c=>c.method==='GET'));
  const workerEvidence=JSON.parse(JSON.stringify(response.body));
  const props={result,workerEvidence,creatorEvidence:{mint,creator,status:'VERIFIED',independentlyReviewed:reviewed}};
  const adapted=adaptDashboardEvidence({...props,now:Date.parse(now)});
  assert.equal(consolidate(adapted.scores).score,null);
  assert.equal(adapted.creatorVerified,reviewed===true);
  assert.equal(adapted.creatorCompatible,reviewed===true&&!stale);
  assert.ok(Object.values(adapted.scores).every(s=>s.calibrated===false));
  assert.match(renderToStaticMarkup(createElement(Dashboard,props)),/Overall Score: Pending/);
  assert.deepEqual(raw,baseline);
 }
});
test('actual GET missing/error evidence remains Pending',async()=>{
 const GET=api(async()=>{throw Error('SYNTHETIC_PRIVATE_ERROR');});
 const response=await GET(new Request('https://example.invalid/api/scoring-evidence?mint='+mint));
 assert.doesNotMatch(JSON.stringify(response.body),/SYNTHETIC_PRIVATE_ERROR|synthetic-only/);
 const props={result,workerEvidence:response.body};assert.equal(consolidate(adaptDashboardEvidence(props).scores).score,null);assert.match(renderToStaticMarkup(createElement(Dashboard,props)),/Overall Score: Pending/);
});
