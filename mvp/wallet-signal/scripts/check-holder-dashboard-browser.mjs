// Offline isolated real-component browser harness. No app/server/provider routes.
import {createRequire} from 'node:module';
import {mkdtemp,writeFile,readFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const {chromium}=require('playwright'),compiled=require('next/dist/compiled/webpack/webpack');compiled.init();
const temp=await mkdtemp(path.join(tmpdir(),'holder-browser-'));
const loader=path.join(temp,'loader.cjs');
await writeFile(loader,`module.exports=function(source){const callback=this.async();require(${JSON.stringify(require.resolve('next/dist/build/swc'))}).transform(source,{filename:this.resourcePath,jsc:{parser:{syntax:'ecmascript',jsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'es6'}}).then(r=>callback(null,r.code),callback);};`);
await writeFile(path.join(temp,'entry.jsx'),`import React from 'react';import {createRoot} from 'react-dom/client';import Dashboard from ${JSON.stringify(path.join(root,'app/GlitchV11Dashboard.jsx'))};import Map from ${JSON.stringify(path.join(root,'app/HolderBubbleMap.jsx'))};const root=createRoot(document.getElementById('root'));window.unmountHolder=()=>root.unmount();window.renderHolder=(props,map=false)=>root.render(map?<Map {...props}/>:<Dashboard {...props}/>);`);
await new Promise((resolve,reject)=>compiled.webpack({mode:'development',context:root,entry:path.join(temp,'entry.jsx'),output:{path:temp,filename:'bundle.js'},resolve:{modules:[path.join(root,'node_modules'),'node_modules'],extensions:['.js','.jsx','.mjs']},module:{rules:[{test:/\.(jsx|mjs|js)$/,exclude:/node_modules/,use:loader}]},devtool:false},(error,stats)=>error||stats.hasErrors()?reject(error||Error(stats.toString({all:false,errors:true}))):resolve()));
const browser=await chromium.launch({headless:true,...(process.env.HOLDER_BROWSER_EXECUTABLE?{executablePath:process.env.HOLDER_BROWSER_EXECUTABLE}:{})});const artifact=process.env.HOLDER_BROWSER_ARTIFACT_DIR||path.join(temp,'artifacts');await mkdir(artifact,{recursive:true});
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump',a='3'.repeat(32),b='4'.repeat(32),sig='2'.repeat(64),sig2='3'.repeat(64);
const holders=[{ownerWallet:a,tokenAccount:'5'.repeat(32),sharePct:1},{ownerWallet:b,tokenAccount:'6'.repeat(32),sharePct:null}];
const groups=[{members:[a,b],directEdges:[{walletA:a,walletB:b,signatures:[sig,sig2]}]}];
const historical={mint,jobId:'offline',holders,connectedGroups:groups,directPairs:1,connectedWallets:2,transactionsChecked:1};
let forbidden=0;const errors=[];
// Additional narrow populated-map case; synthetic inputs, no server routes.
try{
 // Full-screen focus lifecycle on the actual component; surrounding controls are synthetic.
 for(const width of [393,1280]){
  const context=await browser.newContext({viewport:{width,height:852},serviceWorkers:'block'});
  await context.route('**/*',r=>{forbidden++;return r.abort();});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<button id="before">Background before</button><div id="root"></div><button id="after">Background after</button>');
  await page.addScriptTag({content:await readFile(path.join(temp,'bundle.js'),'utf8')});
  await page.evaluate(p=>window.renderHolder(p),{result:{mint,authorityDetailsStatus:'not_parsed'}});
  const toggle=page.getByRole('button',{name:'Open full screen'});
  for(let repeat=0;repeat<2;repeat++){
   await toggle.focus();await page.keyboard.press('Enter');
   const exit=page.getByRole('button',{name:'Exit full screen'});await exit.waitFor();
   assert.equal(await page.getByRole('dialog').getAttribute('aria-modal'),'true');
   assert.equal(await page.evaluate(()=>getComputedStyle(document.body).overflow),'hidden');
   await page.keyboard.press('Shift+Tab');
   assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Creator Intelligence');
   await page.keyboard.press('Tab');assert.equal(await exit.evaluate(e=>e===document.activeElement),true);
   for(const name of ['Overall','Token Security','Holder Intelligence','Liquidity & Safety','Creator Intelligence']){
    await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.textContent),name);
   }
   await page.keyboard.press('Tab');assert.equal(await exit.evaluate(e=>e===document.activeElement),true);
   await page.locator('#after').evaluate(e=>e.focus());assert.equal(await exit.evaluate(e=>e===document.activeElement),true);
   if(repeat===0)await page.keyboard.press('Escape');else await exit.click();
   await toggle.waitFor();assert.equal(await toggle.evaluate(e=>e===document.activeElement),true);
   assert.equal(await page.getByRole('dialog').count(),0);
   assert.notEqual(await page.evaluate(()=>getComputedStyle(document.body).overflow),'hidden');
   await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'before');
  }
  await toggle.click();await page.getByRole('dialog').waitFor();
  await page.evaluate(()=>window.unmountHolder());assert.equal(await page.locator('.g11-full').count(),0);
  assert.notEqual(await page.evaluate(()=>getComputedStyle(document.body).overflow),'hidden');
  await page.locator('#before').focus();await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'after');
  assert.equal(await page.evaluate(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',cancelable:true,bubbles:true}))),true);
  await context.close();
 }
 {
 const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
 const holders=Array.from({length:20},(_,i)=>({ownerWallet:'3'.repeat(31)+alphabet[i],tokenAccount:'4'.repeat(31)+alphabet[i],sharePct:1}));
 const groups=[{members:holders.map(h=>h.ownerWallet),directEdges:holders.slice(1).map(h=>({walletA:holders[0].ownerWallet,walletB:h.ownerWallet,signatures:['2'.repeat(64)]}))}];

 const context=await browser.newContext({viewport:{width:320,height:720},serviceWorkers:'block'});
 await context.route('**/*',r=>{forbidden++;return r.abort();});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(5000);
 await page.setContent('<body style="margin:0"><div id="root"></div></body>');await page.addScriptTag({content:await readFile(path.join(temp,'bundle.js'),'utf8')});
 await page.evaluate(p=>window.renderHolder(p,true),{holders,groups,identityKey:'synthetic-320-20'});
 const nodes=page.getByRole('button',{name:/Wallet .*observed supply/});await nodes.first().waitFor();assert.equal(await nodes.count(),20);
 for(let i=0;i<20;i++){await nodes.nth(i).focus();await page.keyboard.press('Enter');assert.equal(await nodes.nth(i).getAttribute('aria-pressed'),'true');}
 await page.getByText('View transaction evidence').click();assert.equal(await page.locator('li').filter({hasText:'Candidate reference — unverified'}).count(),1);
 await page.getByRole('button',{name:'Reset',exact:true}).focus();await page.keyboard.press('Enter');assert.equal(await page.locator('circle[aria-pressed="true"]').count(),0);
 await page.getByRole('combobox',{name:'Filter by connected cluster'}).selectOption('0');
 for(const name of ['Zoom in','Zoom out']){await page.getByRole('button',{name,exact:true}).focus();await page.keyboard.press('Enter');}
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
 for(const selector of ['select','button[aria-label="Zoom in"]','button[aria-label="Zoom out"]']){const box=await page.locator(selector).boundingBox();assert.ok(box.x>=0&&box.x+box.width<=322);}
 await page.screenshot({path:path.join(artifact,'map-320-20-wallets.png'),fullPage:true});
 assert.deepEqual(errors,[]);
 await context.close();
 }
 for(const width of [390,1280]){
  const page=await browser.newPage({viewport:{width,height:900}});page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{forbidden++;return route.abort();});
  await page.setContent('<html><body style="margin:0;background:#08090c"><div id="root"></div></body></html>');await page.addScriptTag({content:await readFile(path.join(temp,'bundle.js'),'utf8')});
  const props={result:{mint},historicalHolders:historical,holderEvidenceState:'loading'};
  await page.evaluate(p=>window.renderHolder(p),props);
  await page.getByRole('button',{name:'Holder Intelligence',exact:true}).click();await page.getByText('Loading Holder evidence…').waitFor();
  await page.evaluate(p=>window.renderHolder({...p,holderEvidenceState:'error'}),props);await page.getByText(/Holder evidence provider unavailable/).waitFor();
  await page.getByText(/original ranking 20; eligible view 19/).waitFor();
  for(let n=0;n<3;n++){
   await page.getByRole('button',{name:'Connection map',exact:true}).click();await page.getByRole('group',{name:'Interactive wallet connection network'}).waitFor();
   await page.getByRole('button',{name:'Overview',exact:true}).click();
   await page.getByRole('button',{name:'Holder Intelligence',exact:true}).click();
  }
  await page.getByRole('button',{name:'Connection map',exact:true}).click();
  await page.getByRole('button',{name:'Overall',exact:true}).click();await page.getByRole('button',{name:'Holder Intelligence',exact:true}).click();await page.getByRole('group',{name:'Interactive wallet connection network'}).waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'no horizontal overflow');
  await page.screenshot({path:path.join(artifact,`dashboard-${width}.png`),fullPage:true});
  // Liquidity expiry must work without parent polling or another prop render.
  await page.clock.install();const observedAt=await page.evaluate(()=>new Date().toISOString());
  const liquidity={mint,provider:'DexScreener',observedAt,status:'pools_reported',reportedLiquidityUsd:1234,poolCountReturned:1,pools:[{pairAddress:a,liquidityUsd:1234}]};
  await page.evaluate(p=>window.renderHolder(p),{result:{mint},liquidity});
  await page.getByRole('button',{name:'Liquidity & Safety',exact:true}).click();await page.getByText('$1,234',{exact:true}).waitFor();
  const summary=page.getByText('Liquidity observation evidence',{exact:true});await summary.focus();await page.keyboard.press('Enter');
  await page.getByText(/Provider observation time:/).waitFor();assert.equal(await page.locator('time').getAttribute('datetime'),observedAt);
  assert.equal(await page.locator('a[href="https://solscan.io/account/'+a+'"]').count(),1);
  await page.clock.fastForward(3600001);await page.getByText(/Observation expired, future-dated or unavailable/).waitFor();assert.equal(await page.getByText('$1,234',{exact:true}).count(),0);
  await page.evaluate(p=>window.renderHolder(p),{result:{mint},liquidity:{...liquidity,observedAt:new Date(Date.parse(observedAt)+3600001).toISOString(),reportedLiquidityUsd:0}});await page.getByText('$0',{exact:true}).waitFor();
  await page.evaluate(p=>window.renderHolder(p),{result:{mint},liquidityRefreshing:true});await page.getByText('Loading provider liquidity observations…').waitFor();assert.equal(await page.getByText('$0',{exact:true}).count(),0);
  await page.evaluate(p=>window.renderHolder(p),{result:{mint},liquidityError:'offline'});await page.getByText('Liquidity provider unavailable; estimates withheld.').waitFor();
  const freshAt=await page.evaluate(()=>new Date().toISOString());
  await page.evaluate(p=>window.renderHolder(p),{result:{mint},liquidity:{...liquidity,observedAt:freshAt,reportedLiquidityUsd:null,pools:[{pairAddress:a,evidenceConflict:true,url:'javascript:alert(1)'}]},workerEvidence:{version:'1.1',mint,liquidity:{mint,status:'partial',observedAt:freshAt,updatedAt:freshAt,checkedPoolCount:0,reportedPoolCount:1,failedBatchCount:1}}});
  await page.getByText(/Conflicting pool observations/).waitFor();await page.getByText(/0 checked \/ 1 reported pools; 1 failed batches/).waitFor();assert.equal(await page.locator('a[href^="javascript:"]').count(),0);
  await page.evaluate(p=>window.renderHolder(p),{result:{mint},workerEvidence:{version:'1.1',mint,liquidity:{mint,status:'failed',updatedAt:freshAt,checkedPoolCount:10}}});await page.getByText(/Unknown — missing, stale or unavailable/).waitFor();assert.equal(await page.locator('a[href*="solscan.io/account/"]').count(),0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));await page.screenshot({path:path.join(artifact,`liquidity-evidence-${width}.png`),fullPage:true});
  // Creator and Holder freshness must expire without parent polling/prop changes.
  const creatorTime=await page.evaluate(()=>new Date().toISOString());
  await page.evaluate(p=>window.renderHolder(p),{result:{mint},creatorEvidence:{mint,creator:a,status:'VERIFIED',independentlyReviewed:true},workerEvidence:{version:'1.1',mint,creator:{mint,creator:a,updatedAt:creatorTime,holdings:{supplySharePct:1.2345,observedAt:creatorTime},previousLaunchCount:7}}});
  await page.getByRole('button',{name:'Creator Intelligence',exact:true}).click();await page.getByText('7 attributed launches',{exact:true}).waitFor();
  assert.match(await page.locator('.g11-data article').filter({hasText:'Creator Holdings'}).innerText(),/1.23% observed/);
  await page.clock.fastForward(3600001);await page.waitForFunction(()=>[...document.querySelectorAll('.g11-data article')].find(e=>e.textContent.includes('Creator Holdings'))?.querySelector('strong').textContent==='Pending');assert.equal(await page.getByText('7 attributed launches',{exact:true}).count(),0);
  const holderTime=await page.evaluate(()=>new Date().toISOString()),alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const fullHolders=Array.from({length:20},(_,i)=>({ownerWallet:'3'.repeat(31)+alphabet[i],tokenAccount:'4'.repeat(31)+alphabet[i],sharePct:1}));
  const assessment={version:'1.1',attribute:'holder_intelligence',components:Object.entries({top20_holder_concentration:35,connected_wallet_network:35,creator_team_exposure:20,holder_breadth_independence:10}).map(([id,max])=>({id,max,points:max})),evidence:{pairs:[],counts:{pending:0,unavailable:0}}};
  await page.evaluate(p=>window.renderHolder(p),{result:{mint},concentration:{mint,accounts:fullHolders,top20TokenAccountSharePct:20},historicalHolders:{...historical,holders:fullHolders,updatedAt:holderTime},verifiedHolderEnvelope:{mint,jobId:historical.jobId,updatedAt:holderTime,assessment}});
  await page.getByRole('button',{name:'Holder Intelligence',exact:true}).click();await page.locator('.g11-inspector').getByText('100%',{exact:true}).waitFor();await page.clock.fastForward(3600001);await page.locator('.g11-inspector').getByText('35%',{exact:true}).waitFor();await page.getByText('Overall Score: Pending',{exact:true}).waitFor();
  const map={holders,groups,identityKey:'first',verifiedAssessment:{evidence:{pairs:[{walletA:a,walletB:b,signatures:[sig]}],counts:{pending:1,unavailable:0}}}};
  await page.evaluate(p=>window.renderHolder(p,true),map);
  const nodes=page.getByRole('button',{name:/Wallet .*observed supply/});await nodes.first().focus();await page.keyboard.press('Enter');
  await page.getByText('View transaction evidence').click();await page.locator('li').filter({hasText:'Candidate reference — unverified'}).waitFor();await page.locator('li').filter({hasText:'Verified transfer'}).waitFor();
  assert.ok(await page.locator('a[href*="solscan.io/tx/"]').count()===2);await page.getByRole('button',{name:/Wallet .*Unknown holdings/}).focus();await page.keyboard.press('Space');
  await page.getByRole('button',{name:'Zoom in',exact:true}).click();await page.getByRole('button',{name:'Reset',exact:true}).click();
  await page.getByRole('checkbox',{name:'Connected wallets only'}).check();await page.getByRole('combobox',{name:'Filter by connected cluster'}).selectOption('0');
  await page.evaluate(p=>window.renderHolder({...p,identityKey:'second',holders:[],groups:[]},true),map);await page.getByText(/No holder map data available/).waitFor();
  assert.equal(await page.getByRole('checkbox').isChecked(),false);assert.equal(await page.getByRole('combobox').inputValue(),'all');
  await page.close();
 }
 assert.equal(forbidden,0);assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,widths:[390,1280],networkRequests:forbidden,fullscreenLifecycleWidths:[393,1280],liquidityCasesPerViewport:8,creatorHolderExpiryCasesPerViewport:2,artifacts:artifact}));
}finally{await browser.close();}
