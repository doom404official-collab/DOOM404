// Run explicitly: node tests/ui-layout-acceptance.mjs
// Replayed API contracts isolate layout/interaction checks from provider billing.
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {replay,referenceMint} from './fixtures/ui-assessment-replay.mjs';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const root=process.env.UI_APP_ROOT||process.cwd(),out=process.env.UI_ARTIFACT_DIR||path.join(root,'test-artifacts/ui-refinement');
await fs.mkdir(out,{recursive:true});
const server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port','3000'],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});
let logs='';for(const stream of [server.stdout,server.stderr])stream.on('data',s=>{logs+=s;});
let browser;const results=[],requests=[],errors=[];
const baseline=process.env.UI_BASELINE==='1';
try{
 for(let n=0;n<150;n++){if(logs.includes('Ready in'))break;if(server.exitCode!==null)throw Error(logs);await new Promise(r=>setTimeout(r,200));}
 browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
 for(const width of baseline?[390,1440]:[320,337,360,390,449,768,1024,1440]){
  const height=width<768?844:1000,context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,permissions:['clipboard-read','clipboard-write'],reducedMotion:'reduce'}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',async route=>{
   const url=new URL(route.request().url()),mint=url.searchParams.get('mint')||referenceMint,fixture=replay(mint);requests.push({path:url.pathname,mint,method:route.request().method(),query:url.search});
   if(url.pathname==='/api/token-current'){
    await new Promise(r=>setTimeout(r,150));
    if(mint==='invalid-mint')return route.fulfill({status:400,json:{mint,error:'INVALID_MINT'}});
    return route.fulfill({json:fixture.result});
   }
   const values={'/api/creator-evidence':fixture.creatorEvidence,'/api/scoring-evidence':fixture.workerEvidence,'/api/current-liquidity':{mint,observation:fixture.currentLiquidity},'/api/current-creator':fixture.currentCreator,'/api/token-liquidity':fixture.reportedLiquidity,'/api/holder-scan-status':{mint,status:'not_started'},'/api/holder-assessment':{mint,assessment:null},'/api/token-concentration':{mint}};
   await route.fulfill({json:values[url.pathname]||{mint,status:'unavailable'}});
  });
  await page.goto('http://127.0.0.1:3000/',{waitUntil:'networkidle',timeout:60000});
  const input=page.getByRole('textbox',{name:'Solana token mint address'});
  await input.fill(referenceMint);await input.press('Enter');
  assert.equal(await page.getByRole('button',{name:'INSPECTING...',exact:true}).isDisabled(),true);
  await page.locator('.g11-attribute-card').first().waitFor({timeout:15000});
  await page.waitForFunction(()=>document.querySelector('.g11-coverage progress')?.value===82.5,{timeout:15000});
  await page.locator('.g11').scrollIntoViewIfNeeded();
  const metrics=await page.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,nav:[...document.querySelectorAll('.g11-attribute-tabs button')].map(e=>{const r=e.getBoundingClientRect();return {height:r.height,width:r.width,left:r.left,right:r.right,label:e.innerText};}),mascot:document.querySelector('.g11-mascot')?.complete,summaryBottom:document.querySelector('.g11-attribute-cards')?.getBoundingClientRect().bottom}));
  if(!baseline){
   assert.equal(metrics.overflow,false,`Overflow at ${width}`);assert.equal(metrics.nav.length,5);
   assert.ok(metrics.nav.every(b=>b.height>=44&&b.left>=0&&b.right<=width+1),`Tabs at ${width}`);
   assert.equal(metrics.mascot,true);assert.ok(metrics.summaryBottom<=height,`Score summary outside initial assessment viewport at ${width}`);
   assert.equal(await page.locator('.g11-disclaimer').count(),1);
   assert.equal(await page.locator('.g11-disclaimer').innerText().then(t=>(t.match(/not financial advice/g)||[]).length),1);
   await page.getByRole('button',{name:'Open Holder Intelligence assessment',exact:true}).click();
   assert.equal(await page.getByRole('button',{name:'Holder Intelligence',exact:true}).getAttribute('aria-current'),'page');
   await page.getByRole('button',{name:'Copy full mint address',exact:true}).click();
   assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),referenceMint);
   await page.getByRole('button',{name:'Open full screen',exact:true}).click();assert.equal(await page.locator('.g11[role="dialog"]').count(),1);
   await page.keyboard.press('Escape');assert.equal(await page.locator('.g11[role="dialog"]').count(),0);
  }
  for(const [id,label] of [['overall','Overall'],['token_security','Token Security'],['holder_intelligence','Holder Intelligence'],['liquidity_quality_safety','Liquidity & Safety'],['creator_intelligence','Creator Intelligence']]){
   await page.getByRole('button',{name:label,exact:true}).click();
   if(!baseline){assert.equal(await page.getByRole('button',{name:label,exact:true}).getAttribute('aria-current'),'page');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);}
   if(width===390||width===1440)await page.screenshot({path:path.join(out,`${baseline?'before':'after'}-${width}-${id}.png`)});
   if(!baseline&&id!=='overall'){
    const evidence=page.getByText('Supporting evidence and observation times',{exact:true});await evidence.click();assert.equal(await evidence.evaluate(e=>e.parentElement.open),true);await evidence.click();assert.equal(await evidence.evaluate(e=>e.parentElement.open),false);
   }
  }
  await page.getByRole('button',{name:'Overall',exact:true}).click();
  if(!baseline){
   await page.locator('.g11-disclaimer').scrollIntoViewIfNeeded();if(width===390)await page.screenshot({path:path.join(out,'after-390-disclaimer.png')});
   // Paste, invalid input and sequential scans must not retain the previous token.
   await input.fill('invalid-mint');await page.getByRole('button',{name:'INSPECT TOKEN',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(await page.locator('.g11').count(),0);
   await page.evaluate(m=>navigator.clipboard.writeText(m),referenceMint);await input.focus();await input.press('ControlOrMeta+A');await input.press('ControlOrMeta+V');assert.equal(await input.inputValue(),referenceMint);
   await input.press('Enter');await page.locator('.g11').waitFor();
   const second='So11111111111111111111111111111111111111112';await input.fill(second);assert.equal(await page.locator('.g11').count(),0);await input.press('Enter');await page.locator('.g11-token code').waitFor();assert.equal(await page.locator('.g11-token code').getAttribute('title'),second);
  }
  results.push({width,height,status:'PASS',...metrics});await context.close();console.log('PASS',baseline?'baseline':'refined',width);
 }
 assert.equal(errors.length,0,errors.join('\n'));
 assert.ok(requests.every(r=>r.method==='GET'&&!r.query.includes('mode=history')&&!/scan-start|scan-tick|worker/.test(r.path)));
 await fs.writeFile(path.join(out,'layout-results.json'),JSON.stringify({mode:baseline?'accepted-source-replay':'refined-source-replay',results,requests,errors,providerConsumption:0},null,2));
}finally{
 await browser?.close();server.kill('SIGTERM');await fs.writeFile(path.join(out,'dev-server.log'),logs);
}
