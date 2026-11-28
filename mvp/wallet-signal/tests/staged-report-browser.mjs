import {spawn} from 'node:child_process';import fs from 'node:fs';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {replay} from './fixtures/ui-assessment-replay.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=process.env.SCANNER_TEST_URL?null:spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3101','-H','127.0.0.1'],{stdio:['ignore','pipe','pipe']});
if(server)await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(Error('Test server startup timed out')),10000);server.stdout.on('data',x=>{output+=x;if(output.includes('Ready in')){clearTimeout(timer);resolve();}});server.on('exit',code=>reject(Error('Test server exited '+code)));});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/tmp/chromium',args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),root=process.env.SCANNER_TEST_URL||'http://127.0.0.1:3101',r=replay();r.result.decimals=6;r.reportedLiquidity.tokenMetadata={mint:r.result.mint,name:'Paid',symbol:'PAID'};r.reportedLiquidity.pools=[{pairAddress:r.currentLiquidity.pool}];r.currentLiquidity.referenceQuotes[2].impactIncludingFeesPct=40;
const errors=[],calls=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));page.on('pageerror',e=>errors.push(e.message));
let workerCompleted=false;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await context.route('**/api/**',async route=>{const url=new URL(route.request().url()),path=url.pathname,mint=url.searchParams.get('mint');calls.push({path,extended:url.searchParams.get('extend')==='1',at:Date.now()});let data={mint};
 if(path==='/api/token-current'){await sleep(100);data=r.result;}
 else if(path==='/api/token-concentration'){await sleep(180);data={mint,sampledWalletObservation:{version:2,atomicSubset:true,eligibleWallets:1,observedAt:new Date().toISOString(),supplyRaw:'1000000000000000',wallets:[{wallet:r.currentCreator.creator,amountRaw:'1000000000000'}],observedSharePct:.1,largestSharePct:.1,contextSlots:{mint:1,sampledAccounts:1}}};}
 else if(path==='/api/creator-evidence')data=r.creatorEvidence;
 else if(path==='/api/scoring-evidence'){data=structuredClone(r.workerEvidence);if(workerCompleted)data.creator.behaviourV2.ledger.acceptedCount=19;}
 else if(path==='/api/current-creator')data=r.currentCreator;
 else if(path==='/api/token-liquidity'){await sleep(120);data=r.reportedLiquidity;}
 else if(path==='/api/current-liquidity'){await sleep(220);data={mint,observation:r.currentLiquidity};}
 else if(path==='/api/token-investigation'){await sleep(2200);workerCompleted=true;data={mint,status:'investigation_completed',creator:{creator:r.currentCreator.creator}};}
 await route.fulfill({status:200,headers:{'content-type':'application/json','X-Glitch-Rpc-Requests':'1','X-Glitch-Rpc-Calls':'1','Server-Timing':'fixture;dur=1'},body:JSON.stringify(data)});
});
const out=process.env.UI_ARTIFACT_DIR||'/tmp/doom-staged-report';fs.mkdirSync(out,{recursive:true});
try{
 await page.goto(root);await page.getByRole('textbox',{name:'Solana token mint address',exact:true}).fill(r.result.mint);
 await page.evaluate(()=>{const observer=new MutationObserver(()=>{if(document.querySelector('.scanner-progress')&&!window.__scanningAckAt)window.__scanningAckAt=Date.now();if(document.querySelector('[data-first-evidence=true]')&&!window.__firstVerifiedAt)window.__firstVerifiedAt=Date.now();});observer.observe(document.documentElement,{subtree:true,attributes:true,childList:true});});
 const popup=page.waitForEvent('popup');const start=Date.now();await page.getByRole('button',{name:'INSPECT TOKEN',exact:true}).click();
 const report=await popup;await report.getByRole('button',{name:'Creator Intelligence',exact:true}).waitFor();const initialReportMs=Date.now()-start;const firstVerifiedAt=await page.evaluate(()=>window.__firstVerifiedAt||null);const firstEvidenceMs=firstVerifiedAt?firstVerifiedAt-start:initialReportMs;const acknowledgementMs=(await page.evaluate(()=>window.__scanningAckAt))-start;assert.ok(acknowledgementMs>=0&&acknowledgementMs<=1000);
 await report.locator('[data-investigation-stage=deep_in_progress]').waitFor();assert.equal(workerCompleted,false,'initial report cannot wait for deep history');
 await report.screenshot({path:out+'/initial-390.png',fullPage:true});
 await report.locator('[data-investigation-stage=bounded_complete]').waitFor({timeout:10000});const boundedMs=Date.now()-start;
 await report.getByRole('button',{name:'Creator Intelligence',exact:true}).click();assert.match(await report.locator('.hud-metrics').last().innerText(),/19/);
 const id=new URL(report.url()).searchParams.get('report');assert.ok(id);const before=calls.length;await report.reload();await report.getByRole('button',{name:'Overview',exact:true}).waitFor();await sleep(250);assert.equal(calls.length,before,'saved report reload makes no provider or worker calls');assert.equal(new URL(report.url()).searchParams.get('report'),id);
 await report.getByRole('button',{name:'Overview',exact:true}).click();await report.locator('.simple-critical-status').first().waitFor();
 assert.equal(await report.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await report.screenshot({path:out+'/complete-390.png',fullPage:true});assert.equal(calls.filter(x=>x.path==='/api/token-investigation').length,1);assert.equal(calls.filter(x=>x.extended).length,1);assert.equal(errors.length,0);
 const normalCalls=calls.length;await context.route(/\/api\/token-current\?/,route=>route.fulfill({status:429,headers:{'content-type':'application/json','Retry-After':'120'},body:JSON.stringify({error:'RATE_LIMIT'})}));
 await page.reload();await page.getByRole('textbox',{name:'Solana token mint address',exact:true}).fill(r.result.mint);await page.getByRole('button',{name:'INSPECT TOKEN',exact:true}).click();await page.getByText('Scanner request limit reached. Try again in approximately 2 minute(s). No token assessment was completed.',{exact:true}).waitFor();assert.equal(await page.getByRole('link',{name:'VIEW INTELLIGENCE REPORT',exact:true}).count(),0);assert.equal(calls.filter(x=>x.path==='/api/token-investigation').length,1);
 fs.writeFileSync(out+'/acceptance.json',JSON.stringify({scope:'Local actual Next.js UI with deterministic mocked API transport; not live intelligence or hosted timing.',acknowledgementMs,firstEvidenceMs,initialReportMs,boundedMs,calls:calls.slice(0,normalCalls),errors,quotaFailureCommunication:'PASS',savedReportReload:'PASS',progressiveEventCount:19},null,2));console.log(JSON.stringify({acknowledgementMs,firstEvidenceMs,initialReportMs,boundedMs,calls:normalCalls,quotaFailureCommunication:'PASS',errors}));
}finally{await browser.close();server?.kill('SIGTERM');}
