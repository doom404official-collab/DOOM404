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
await writeFile(path.join(temp,'entry.jsx'),`import React from 'react';import {createRoot} from 'react-dom/client';import Dashboard from ${JSON.stringify(path.join(root,'app/GlitchV11Dashboard.jsx'))};import Map from ${JSON.stringify(path.join(root,'app/HolderBubbleMap.jsx'))};const root=createRoot(document.getElementById('root'));window.renderHolder=(props,map=false)=>root.render(map?<Map {...props}/>:<Dashboard {...props}/>);`);
await new Promise((resolve,reject)=>compiled.webpack({mode:'development',context:root,entry:path.join(temp,'entry.jsx'),output:{path:temp,filename:'bundle.js'},resolve:{modules:[path.join(root,'node_modules'),'node_modules'],extensions:['.js','.jsx','.mjs']},module:{rules:[{test:/\.(jsx|mjs|js)$/,exclude:/node_modules/,use:loader}]},devtool:false},(error,stats)=>error||stats.hasErrors()?reject(error||Error(stats.toString({all:false,errors:true}))):resolve()));
const browser=await chromium.launch({headless:true,...(process.env.HOLDER_BROWSER_EXECUTABLE?{executablePath:process.env.HOLDER_BROWSER_EXECUTABLE}:{})});const artifact=process.env.HOLDER_BROWSER_ARTIFACT_DIR||path.join(temp,'artifacts');await mkdir(artifact,{recursive:true});
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump',a='3'.repeat(32),b='4'.repeat(32),sig='2'.repeat(64),sig2='3'.repeat(64);
const holders=[{ownerWallet:a,tokenAccount:'5'.repeat(32),sharePct:1},{ownerWallet:b,tokenAccount:'6'.repeat(32),sharePct:null}];
const groups=[{members:[a,b],directEdges:[{walletA:a,walletB:b,signatures:[sig,sig2]}]}];
const historical={mint,jobId:'offline',holders,connectedGroups:groups,directPairs:1,connectedWallets:2,transactionsChecked:1};
let forbidden=0;const errors=[];
try{
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
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'no horizontal overflow');
  await page.screenshot({path:path.join(artifact,`dashboard-${width}.png`),fullPage:true});
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
 assert.equal(forbidden,0);assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,widths:[390,1280],networkRequests:forbidden,artifacts:artifact}));
}finally{await browser.close();}
