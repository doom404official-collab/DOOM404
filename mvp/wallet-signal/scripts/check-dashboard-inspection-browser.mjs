// Actual page, local assets only; every API request is replaced before dispatch.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)('playwright');
const base='http://127.0.0.1:3111',artifacts='/tmp/dashboard-inspection-artifacts';
await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium'});let checks=0;
try{for(const width of [320,393,1440]){
 const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),page=await context.newPage();const forbidden=[],errors=[];
 page.setDefaultTimeout(5000);
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==base||u.pathname.startsWith('/api/')){forbidden.push(u.pathname);return route.abort();}return route.continue();});
 await page.addInitScript(()=>{
  const original=window.fetch;window.mock={mode:'valid',pending:[],calls:[],scoringPending:[],scoringSignals:[],holdScoring:false,denied:[],liquidityPending:[],liquiditySignals:[]};
  window.fetch=async(url,options)=>{
   if(!String(url).startsWith('/api/'))return original(url,options);
   const u=new URL(url,location.origin),mint=u.searchParams.get('mint'),path=u.pathname;window.mock.calls.push(path);
   if(options?.method&&options.method!=='GET'){window.mock.denied.push(path);throw Error('NON_READ_REQUEST');}
   const reply=(data,ok=true)=>({ok,status:ok?200:503,json:async()=>data});
   if(path==='/api/creator'){
    const data={mint,tokenProgram:window.mock.mode==='extension'?'spl-token-2022':'spl-token',mintAuthority:mint==='7'.repeat(32)?'3'.repeat(32):null,freezeAuthority:null,authorityDetailsStatus:'parsed',mintOrigin:{coverage:{}}};
    if(['held','late-liquidity'].includes(window.mock.mode))return new Promise(resolve=>window.mock.pending.push(()=>resolve(reply(data))));
    if(window.mock.mode==='body')return {ok:true,json:()=>new Promise(resolve=>window.mock.pending.push(()=>resolve(data)))};
    if(window.mock.mode==='wrong')return reply({...data,mint:'9'.repeat(32)});
    if(window.mock.mode==='error')return reply({error:'SYNTHETIC_PRIVATE_DETAIL'},false);
    return reply(data);
   }
   if(path==='/api/creator-evidence')return reply({mint,status:'CACHE_MISS'});
   if(path==='/api/token-concentration')return reply({mint,accounts:[],top20TokenAccountSharePct:0});
   if(path==='/api/token-extensions')return reply({mint,verified:true,observedAt:new Date().toISOString(),transferFee:{status:'not_observed'}});
   if(path==='/api/token-liquidity'&&window.mock.mode==='late-liquidity'){window.mock.liquiditySignals.push(options.signal);return new Promise(resolve=>window.mock.liquidityPending.push(()=>resolve(reply({mint,status:'pools_reported',observedAt:new Date().toISOString(),reportedLiquidityUsd:999,poolCountReturned:1}))));}
   if(path==='/api/token-liquidity'&&window.mock.mode==='extension')return reply({},false);
   if(path==='/api/token-liquidity')return reply({mint,status:'no_pools_reported',observedAt:new Date().toISOString(),poolCountReturned:0,reportedLiquidityUsd:0});
   if(path==='/api/scoring-evidence'){if(window.mock.holdScoring){window.mock.scoringSignals.push(options.signal);return new Promise(resolve=>window.mock.scoringPending.push(fail=>resolve(fail?reply({},false):reply({mint,liquidity:{mint,status:'partial',updatedAt:new Date().toISOString(),checkedPoolCount:9,reportedPoolCount:10}}))));}return reply({mint});}
   if(path==='/api/holder-scan-status'||path==='/api/holder-assessment')return reply({mint,status:'not_started'});
   window.mock.denied.push(path);throw Error('UNEXPECTED_API:'+path);
  };
 });
 await page.clock.install();await page.goto(base);await page.getByRole('tab',{name:'TOKEN ANALYSIS',exact:true}).click();
 const input=page.getByRole('textbox',{name:'Solana token mint address'}),button=page.getByRole('button',{name:'INSPECT TOKEN',exact:true});
 const mode=value=>page.evaluate(value=>window.mock.mode=value,value);
 const inspect=async mint=>{await input.fill(mint);await button.click();};
 const mintA='7'.repeat(32),mintB='8'.repeat(32);
 await mode('held');await inspect(mintA);await page.waitForFunction(()=>window.mock.pending.length===1);await input.fill(mintB);await button.waitFor();assert.equal(await page.getByLabel('GLITCH Intelligence v1.1').count(),0);checks++;
 await mode('valid');await button.click();await page.getByLabel('GLITCH Intelligence v1.1').waitFor();await page.evaluate(()=>window.mock.pending.shift()());await button.waitFor();
 assert.match(await page.locator('.g11-data article').filter({hasText:'Mint Authority'}).innerText(),/Revoked/);checks++;
 assert.deepEqual(await page.getByRole('navigation',{name:'Attribute navigation'}).getByRole('button').allTextContents(),['Token Security','Holder Intelligence','Liquidity Quality & Safety','Creator Intelligence']);checks++;
 for(let n=0;n<2;n++)for(const name of ['Creator Intelligence','Holder Intelligence','Liquidity Quality & Safety','Token Security']){const tab=page.getByRole('button',{name,exact:true});await tab.focus();await page.keyboard.press('Enter');assert.equal(await tab.getAttribute('aria-current'),'page');assert.notEqual(await tab.evaluate(e=>getComputedStyle(e).outlineStyle),'none');}checks++;
 await page.getByRole('button',{name:'Open full screen'}).click();const box=await page.locator('.g11-full').boundingBox();assert.ok(Math.abs(box.x)<2&&Math.abs(box.y)<2);assert.ok(Math.abs(box.width-width)<2);await page.getByRole('button',{name:'Exit full screen'}).click();checks++;
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));if(width<480){assert.ok(await page.locator('.g11-insights article').first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=12));assert.ok(await page.locator('.g11-inspector small').first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=12));}assert.ok(await page.locator('img').count()>0);await page.screenshot({path:`${artifacts}/dashboard-${width}.png`,fullPage:true});checks++;
 // Older same-mint scoring success must not replace a newer unavailable read.
 await page.evaluate(()=>window.mock.holdScoring=true);await page.clock.runFor(30001);await page.waitForFunction(()=>window.mock.scoringPending.length===1);await page.clock.runFor(30000);await page.waitForFunction(()=>window.mock.scoringPending.length===2);assert.equal(await page.evaluate(()=>window.mock.scoringSignals[0].aborted),true);
 await page.evaluate(()=>window.mock.scoringPending[1](true));await page.evaluate(()=>window.mock.scoringPending[0](false));await page.getByRole('button',{name:'Liquidity Quality & Safety',exact:true}).click();await page.getByText('Liquidity observation evidence',{exact:true}).click();await page.getByText(/Persisted account checks: Unknown/).waitFor();checks++;await page.evaluate(()=>window.mock.holdScoring=false);
 // Fee evidence expires without interaction, even when Liquidity has no timestamp.
 await mode('extension');await inspect(mintB);await button.waitFor();await page.getByRole('button',{name:'Token Security',exact:true}).click();const feeRow=page.locator('.g11-data article').filter({hasText:'Transfer Fee Schedule'});assert.match(await feeRow.innerText(),/Not applicable/);await page.clock.fastForward(3600001);await page.waitForFunction(()=>[...document.querySelectorAll('.g11-data article')].find(e=>e.textContent.includes('Transfer Fee Schedule'))?.textContent.includes('Pending'));checks++;
 // The inspection deadline aborts its child Liquidity read. Same-mint restart stays clean.
 await mode('late-liquidity');await inspect(mintB);await page.waitForFunction(()=>window.mock.pending.length===1);await page.clock.runFor(40000);await page.evaluate(()=>window.mock.pending.shift()());await page.waitForFunction(()=>window.mock.liquidityPending.length===1);await page.clock.runFor(5001);await page.getByText(/Token inspection timed out/).waitFor();assert.equal(await page.evaluate(()=>window.mock.liquiditySignals[0].aborted),true);assert.equal(await page.getByLabel('GLITCH Intelligence v1.1').count(),0);checks++;
 await mode('valid');await button.click();await button.waitFor();await page.getByRole('button',{name:'Liquidity Quality & Safety',exact:true}).click();await page.getByText('$0',{exact:true}).waitFor();await page.evaluate(()=>window.mock.liquidityPending.shift()());assert.equal(await page.getByText('$999',{exact:true}).count(),0);await page.getByText('$0',{exact:true}).waitFor();checks++;
 // Editing even an idle completed mint must remove its previous assessment.
 await input.fill(mintA);assert.equal(await page.getByLabel('GLITCH Intelligence v1.1').count(),0);checks++;
 for(const failure of ['wrong','error']){await mode(failure);await button.click();await page.getByLabel('GLITCH Scanner Token Analysis').getByRole('alert').waitFor();assert.equal(await page.getByLabel('GLITCH Intelligence v1.1').count(),0);assert.ok(!(await page.content()).includes('SYNTHETIC_PRIVATE_DETAIL'));checks++;}
 // Headers succeeded but the body never settles; deadline still releases UI.
 await mode('body');await button.click();await page.waitForFunction(()=>window.mock.pending.length===1);await page.clock.runFor(45001);await page.getByText(/Token inspection timed out/).waitFor();await button.waitFor();await page.evaluate(()=>window.mock.pending.shift()());assert.equal(await page.getByLabel('GLITCH Intelligence v1.1').count(),0);checks++;
 await mode('held');await button.click();await page.waitForFunction(()=>window.mock.pending.length===1);await page.getByRole('tab',{name:'WALLET ANALYSIS',exact:true}).click();await page.evaluate(()=>window.mock.pending.shift()());await page.getByRole('tab',{name:'TOKEN ANALYSIS',exact:true}).click();assert.equal(await page.getByLabel('GLITCH Intelligence v1.1').count(),0);checks++;
 assert.deepEqual(forbidden,[]);assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>window.mock.denied),[]);checks++;await context.close();
}console.log(JSON.stringify({passed:true,checks,artifacts}));}finally{await browser.close();}
