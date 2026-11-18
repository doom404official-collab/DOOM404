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
await writeFile(path.join(temp,'entry.jsx'),`import React from 'react';import {createRoot} from 'react-dom/client';import Dashboard from ${JSON.stringify(path.join(root,'app/page.js'))};import Map from ${JSON.stringify(path.join(root,'app/HolderBubbleMap.jsx'))};const root=createRoot(document.getElementById('root'));window.renderHolder=(props,map=false)=>root.render(map?<Map {...props}/>:<Dashboard {...props}/>);`);
await new Promise((resolve,reject)=>compiled.webpack({mode:'development',context:root,entry:path.join(temp,'entry.jsx'),output:{path:temp,filename:'bundle.js'},resolve:{modules:[path.join(root,'node_modules'),'node_modules'],extensions:['.js','.jsx','.mjs']},module:{rules:[{test:/\.(jsx|mjs|js)$/,exclude:/node_modules/,use:loader}]},devtool:false},(error,stats)=>error||stats.hasErrors()?reject(error||Error(stats.toString({all:false,errors:true}))):resolve()));
const browser=await chromium.launch({headless:true,...(process.env.HOLDER_BROWSER_EXECUTABLE?{executablePath:process.env.HOLDER_BROWSER_EXECUTABLE}:{})});const artifact=process.env.HOLDER_BROWSER_ARTIFACT_DIR||path.join(temp,'artifacts');await mkdir(artifact,{recursive:true});



let escaped=0,checks=0;const errors=[];
try{
 const context=await browser.newContext({viewport:{width:393,height:900},serviceWorkers:'block'});
 await context.route('**/*',r=>{escaped++;return r.abort();});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(5000);
 await page.setContent('<div id="root"></div>');
 await page.evaluate(()=>{window.calls=[];window.mode='optional-stall';window.fetch=async path=>{
  const u=new URL(path,'https://fixture.invalid'),mint=u.searchParams.get('mint');window.calls.push(u.pathname+'?'+u.searchParams);
  const reply=data=>({ok:true,json:async()=>data});
  if(u.pathname==='/api/creator'){
   if(u.searchParams.get('mode')==='history')return new Promise(resolve=>window.releaseHistory=()=>resolve(reply({mint,inspectionMode:'history',mintAuthority:'3'.repeat(32),mintOrigin:{coverage:{nextCursor:'2'.repeat(88)}}})));
   return reply({mint,inspectionMode:'current',tokenProgram:'spl-token-2022',authorityDetailsStatus:'available',mintAuthority:null,freezeAuthority:null,mintOrigin:{coverage:{}}});
  }
  if(u.pathname==='/api/creator-evidence'&&window.mode==='optional-stall')return new Promise(resolve=>window.releaseOptional=()=>resolve(reply({mint,status:'VERIFIED',creator:'3'.repeat(32),independentlyReviewed:true})));
  if(u.pathname==='/api/creator-evidence')return reply({mint,status:'CACHE_MISS'});
  if(u.pathname==='/api/scoring-evidence')return reply({mint});
  if(['/api/holder-scan-status','/api/holder-assessment'].includes(u.pathname))return reply({mint,status:'not_started'});
  if(u.pathname==='/api/token-concentration')return reply({mint,accounts:[],top20TokenAccountSharePct:0});
  if(u.pathname==='/api/token-extensions')return reply({mint,verified:false});
  if(u.pathname==='/api/token-liquidity')return reply({mint,status:'no_pools_reported',observedAt:new Date().toISOString(),poolCountReturned:0,reportedLiquidityUsd:0});
  throw Error('UNEXPECTED_REQUEST');
 };});
 await page.addScriptTag({content:await readFile(path.join(temp,'bundle.js'),'utf8')});await page.evaluate(()=>window.renderHolder({}));await page.clock.install();
 const input=page.getByRole('textbox',{name:'Solana token mint address'}),inspect=page.getByRole('button',{name:'INSPECT TOKEN',exact:true});
 await input.fill('7'.repeat(32));await inspect.click();await page.getByLabel('GLITCH Intelligence v1.1').waitFor();await page.waitForFunction(()=>typeof window.releaseOptional==='function');
 await page.clock.runFor(15000);assert.equal(await page.getByLabel('GLITCH Intelligence v1.1').count(),1);checks++;
 const calls=await page.evaluate(()=>window.calls);assert.ok(calls.some(x=>x.includes('mode=current')));assert.ok(!calls.some(x=>x.includes('mode=history')));for(const path of ['/api/token-concentration','/api/token-extensions','/api/token-liquidity'])assert.ok(!calls.some(x=>x.startsWith(path)));checks++;
 await page.clock.runFor(30001);await page.getByText(/Current mint observation retained/).waitFor();assert.equal(await page.getByLabel('GLITCH Intelligence v1.1').count(),1);checks++;
 await page.evaluate(()=>window.releaseOptional());await page.getByRole('button',{name:'Creator Intelligence',exact:true}).click();assert.equal(await page.getByText('Not independently verified',{exact:true}).count(),1);checks++;
 await page.getByRole('button',{name:'Investigate creator history',exact:true}).click();await page.waitForFunction(()=>typeof window.releaseHistory==='function');await page.clock.runFor(45001);await page.getByText(/Current mint observation retained/).waitFor();assert.equal(await page.getByLabel('GLITCH Intelligence v1.1').count(),1);assert.equal(await page.getByRole('button',{name:'Historical investigation stopped',exact:true}).isDisabled(),true);checks++;
 await page.evaluate(()=>window.releaseHistory());assert.equal(await page.getByRole('button',{name:'Historical investigation stopped',exact:true}).isDisabled(),true);checks++;
 // A fresh user inspection can succeed; history cannot overwrite current authority fields.
 await page.evaluate(()=>window.mode='ready');await input.fill('8'.repeat(32));assert.equal(await page.getByLabel('GLITCH Intelligence v1.1').count(),0);await inspect.click();await page.getByRole('button',{name:'Investigate creator history',exact:true}).waitFor();await page.waitForFunction(()=>!document.querySelector('button[type="submit"]').disabled);
 await page.getByRole('button',{name:'Investigate creator history',exact:true}).click();await page.waitForFunction(()=>typeof window.releaseHistory==='function');await page.evaluate(()=>window.releaseHistory());await page.getByRole('button',{name:'Continue creator history',exact:true}).waitFor();await page.getByRole('button',{name:'Token Security',exact:true}).click();assert.match(await page.locator('.g11-data article').filter({hasText:'Mint Authority'}).innerText(),/Revoked/);checks++;
 // Discard late history on mint edit, retaining existing request ownership guard.
 await page.getByRole('button',{name:'Continue creator history',exact:true}).click();await input.fill('9'.repeat(32));await page.evaluate(()=>window.releaseHistory());assert.equal(await page.getByLabel('GLITCH Intelligence v1.1').count(),0);checks++;
 // Exactly five explicit historical attempts per inspection; no implicit first batch.
 await inspect.click();await page.waitForFunction(()=>!document.querySelector('button[type="submit"]').disabled);
 const prior=await page.evaluate(()=>window.calls.filter(x=>x.includes('mode=history')).length);
 for(let i=0;i<5;i++){
  const button=page.getByRole('button',{name:i===0?'Investigate creator history':'Continue creator history',exact:true});
  await button.click();await page.evaluate(()=>window.releaseHistory());
  await page.waitForFunction(()=>!document.querySelector('button[type="submit"]').disabled);
 }
 assert.equal(await page.getByRole('button',{name:'Continue creator history',exact:true}).isDisabled(),true);
 assert.equal(await page.evaluate(()=>window.calls.filter(x=>x.includes('mode=history')).length)-prior,5);checks++;
 assert.equal(escaped,0);assert.deepEqual(errors,[]);console.log(JSON.stringify({checks,escaped,errors,synthetic:true}));
}finally{await browser.close();}
