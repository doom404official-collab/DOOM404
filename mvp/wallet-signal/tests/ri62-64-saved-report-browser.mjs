// Deterministic production-browser acceptance. Fixtures are presentation inputs,
// never blockchain verification receipts. No provider calls are permitted here.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {replay} from './fixtures/ui-assessment-replay.mjs';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const base=process.env.BROWSER_BASE_URL||'http://127.0.0.1:3100',dir=process.env.UI_ARTIFACT_DIR||'/tmp/doom-ri62-browser';
fs.mkdirSync(dir+'/screenshots',{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/tmp/chromium',args:['--no-sandbox']});
const context=await browser.newContext({isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36'});
const page=await context.newPage(),errors=[],apiRequests=[],rows=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/api/**',r=>{apiRequests.push(r.request().url());return r.abort();});
const reportId='62123456-1234-4234-8234-123456789012';
async function put(props){await page.evaluate(async({id,props})=>{await new Promise((resolve,reject)=>{const r=indexedDB.open('glitch-completed-reports',1);r.onupgradeneeded=()=>r.result.createObjectStore('reports');r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,tx=db.transaction('reports','readwrite');tx.objectStore('reports').put({version:1,createdAt:Date.now(),mint:props.result.mint,props},id);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});},{id:reportId,props});}
function snapshot(stage,revision,{initial=false,expires=false,critical=false}={}){
 const full=replay(),props=initial?{result:full.result}:full;props.liquidity=full.reportedLiquidity;props.result={...props.result,decimals:6,metadata:{name:'Deterministic Browser Fixture',symbol:'FIXTURE'}};props.evidenceRevision=revision;props.investigationProgress={stage,expiresAt:new Date(Date.now()+(expires?-1000:70000)).toISOString(),historyComplete:false};
 if(critical){props.workerEvidence=structuredClone(full.workerEvidence);props.workerEvidence.canonicalHolder.largestHolderSharePct=49.23;props.workerEvidence.canonicalHolder.top20SharePct=60.89;}
 return props;
}
async function checkOverflow(width,tab,state){const metrics=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth,scrollX}));assert.ok(metrics.document<=width+1,JSON.stringify({width,tab,state,...metrics}));rows.push({width,tab,state,...metrics});}
try{
 await page.goto(base);await page.waitForLoadState('networkidle');
 for(const width of [320,337,360,390,449,768,1024,1440]){
  await page.setViewportSize({width,height:900});let revision=1;
  await put(snapshot('deep_in_progress',revision,{initial:true}));await page.goto(base+'/?report='+reportId);await page.locator('[data-scan-state="assessment_in_progress"]').waitFor();
  await page.getByRole('button',{name:'Overview',exact:true}).click();await page.locator('.simple-risk-classification').filter({hasText:'Calculating risk…'}).waitFor();assert.match(await page.locator('.simple-risk').innerText(),/Collecting token intelligence/);assert.doesNotMatch(await page.locator('.simple-risk').innerText(),/Insufficient evidence|Not assessed/);assert.doesNotMatch(await page.locator('.simple-attributes').innerText(),/Insufficient evidence/);
  const statusStyle=await page.locator('[data-scan-state]').evaluate(e=>{const c=getComputedStyle(e);return {color:c.color,border:c.borderLeftColor,background:c.backgroundColor};});
  // Neutral and amber are allowed; red-dominant borders/backgrounds are reserved for actual risk/errors.
  const redDominant=css=>{const [r,g,b]=(css.match(/[\d.]+/g)||[]).map(Number);return r>g*1.7&&r>b*1.25;};assert.equal(redDominant(statusStyle.border),false,JSON.stringify(statusStyle));assert.equal(redDominant(statusStyle.background),false,JSON.stringify(statusStyle));
  await checkOverflow(width,'overall','calculating');
  if(width===390)await page.screenshot({path:dir+'/screenshots/calculating-390.png',fullPage:true});
  await put(snapshot('deep_in_progress',++revision));await page.locator('.simple-risk').filter({hasText:'Provisional observed risk'}).waitFor();assert.ok(await page.locator('[data-gauge="risk"]').count());await checkOverflow(width,'overall','provisional');
  if(width===390)await page.screenshot({path:dir+'/screenshots/provisional-390.png',fullPage:true});
  await put(snapshot('bounded_complete',++revision));await page.locator('[data-scan-state="complete_partial"]').waitFor();assert.match(await page.locator('[data-scan-state]').innerText(),/Scan complete · Some evidence remains unverified/);assert.doesNotMatch(await page.locator('.simple-risk').innerText(),/Provisional/);
  for(const [tab,label] of [['overall','Overview'],['token_security','Token Security'],['holder_intelligence','Holder Intelligence'],['liquidity_quality_safety','Liquidity & Safety'],['creator_intelligence','Creator Intelligence']]){
   await page.getByRole('button',{name:label,exact:true}).click();await page.locator('.simple-risk').waitFor();await checkOverflow(width,tab,'complete');
   await page.locator('details.ti-evidence > summary').click();await page.evaluate(()=>document.querySelectorAll('details').forEach(d=>d.open=true));await checkOverflow(width,tab,'expanded');
   if(width===390)await page.screenshot({path:dir+'/screenshots/'+tab+'-expanded-390.png',fullPage:true});
  }
  await page.reload();await page.locator('[data-scan-state="complete_partial"]').waitFor();assert.ok(await page.locator('[data-gauge="risk"]').count());await checkOverflow(width,'overall','saved-reload');
  await put(snapshot('deep_in_progress',++revision,{initial:true,expires:true}));await page.reload();await page.locator('[data-scan-state="interrupted"]').waitFor();assert.doesNotMatch(await page.locator('[data-scan-state]').innerText(),/complete/i);await checkOverflow(width,'overall','interrupted');
  if(width===390)await page.screenshot({path:dir+'/screenshots/interrupted-390.png',fullPage:true});
  await put(snapshot('deep_in_progress',++revision,{initial:true,critical:true}));await page.reload();await page.locator('.simple-critical-status').waitFor();assert.match(await page.locator('.simple-critical-status').innerText(),/CRITICAL RISK IDENTIFIED/);await checkOverflow(width,'overall','critical-active');
  await put(snapshot('bounded_complete',++revision,{initial:true}));await page.reload();await page.locator('[data-scan-state="complete_insufficient"]').waitFor();assert.match(await page.locator('[data-scan-state]').innerText(),/Insufficient evidence for an overall score/);await checkOverflow(width,'overall','terminal-insufficient');
 }
 const count=await page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('glitch-completed-reports',1);r.onsuccess=()=>{const db=r.result,q=db.transaction('reports').objectStore('reports').count();q.onsuccess=()=>{db.close();resolve(q.result);};q.onerror=()=>reject(q.error);};}));assert.equal(count,1);assert.deepEqual(errors,[]);assert.deepEqual(apiRequests,[]);
 console.log(JSON.stringify({checks:rows.length,viewports:8,tabs:5,savedReports:count,errors,apiRequests}));
}finally{fs.writeFileSync(dir+'/saved-report-browser-results.json',JSON.stringify({kind:'deterministic production browser validation; not live chain evidence',base,rows,errors,apiRequests},null,2));await browser.close();}
