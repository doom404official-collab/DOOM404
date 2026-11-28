// Local retained-evidence browser acceptance; no blockchain/provider traffic.
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const dir=path.resolve(process.env.UI_ARTIFACT_DIR||'test-artifacts/hud-final'),root=dir+'/dist',out=dir+'/screenshots';fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const file=path.join(root,decodeURI(req.url.split('?')[0]));try{res.setHeader('Content-Type',file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':file.endsWith('.webp')?'image/webp':file.endsWith('.js')?'text/javascript':'text/html');res.end(fs.readFileSync(file))}catch{res.statusCode=404;res.end()}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/tmp/chromium',args:['--no-sandbox']});const ctx=await b.newContext({deviceScaleFactor:2,reducedMotion:'reduce'}),p=await ctx.newPage();const errors=[],external=[],rows=[],perf=[];p.on('pageerror',e=>errors.push(e.message));await ctx.route('**/*',route=>{if(!route.request().url().startsWith(base)){external.push(route.request().url());return route.abort();}return route.continue();});
const tabs=['Overall','Token Security','Holder Intelligence','Liquidity & Safety','Creator Intelligence'];
async function ready(){await p.locator('.ti-report').waitFor();await p.evaluate(()=>document.fonts.ready);}
try{
 for(const mode of ['before','after']){
  for(const width of mode==='before'?[390,1440]:[320,337,360,390,449,768,1024,1440]){
   await p.setViewportSize({width,height:width>600?1000:844});const start=Date.now();await p.goto(base+'/'+mode+'.html');await ready();perf.push({mode,width,renderMs:Date.now()-start});
   for(let i=0;i<tabs.length;i++){
    await p.getByRole('button',{name:tabs[i],exact:true}).click();await p.waitForTimeout(30);
    const row=await p.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:innerWidth,tab:document.querySelector('[aria-current=page]')?.getAttribute('aria-label'),gauges:document.querySelectorAll('[data-gauge]').length,disclaimers:document.querySelectorAll('.g11-disclaimer').length,badImages:[...document.images].filter(i=>!i.complete||i.naturalWidth===0).map(i=>i.src),navTargets:[...document.querySelectorAll('.g11-attribute-tabs button')].every(e=>e.getBoundingClientRect().height>=44),reducedMotion:[...document.querySelectorAll('.ti-report *')].every(e=>getComputedStyle(e).animationName==='none')}));
    if(mode==='after'){
     assert.equal(await p.locator('.g11-token h3').count(),0);
     assert.equal(await p.locator('.ti-symbol').textContent(),'PAID');
     assert.equal(await p.getByRole('button',{name:/full screen/i}).count(),0);
     assert.equal(await p.getByText('PROTECTED PREVIEW',{exact:true}).count(),0);
     assert.equal(await p.locator('[data-platform="transparent-vector"]').count(),1);
     assert.equal(await p.locator('image[href*="hologram-platform.png"]').count(),0);
     const alignment=await p.locator('.ti-risk-labels').evaluate(g=>{const texts=[...g.querySelectorAll(':scope>text')].slice(0,5).map(e=>{const r=e.getBBox();return {x:r.x,y:r.y,w:r.width,h:r.height}});return texts.every((r,i)=>i===0||r.y>=texts[i-1].y+texts[i-1].h-1)});
     assert.ok(alignment,`Gauge labels overlap: ${width} ${tabs[i]}`);
    }
    rows.push({mode,width,...row});assert.ok(row.scroll<=width+1,JSON.stringify(row));assert.equal(row.disclaimers,1);assert.ok(row.navTargets);assert.ok(row.reducedMotion);assert.equal(row.badImages.length,0);
    if([390,1440].includes(width))await p.screenshot({path:`${out}/${mode}-${width}-${i}-${['overall','security','holders','liquidity','creator'][i]}.png`,fullPage:true});
   }
  }
 }
 await p.emulateMedia({reducedMotion:'no-preference'});
 await p.getByRole('button',{name:'Holder Intelligence',exact:true}).click();
 assert.notEqual(await p.locator('.hud-radar-beam').evaluate(e=>getComputedStyle(e).animationName),'none');
 await p.emulateMedia({reducedMotion:'reduce'});
 await p.setViewportSize({width:390,height:844});
 await p.goto(base+'/after.html?missing=1');await ready();for(const tab of tabs){await p.getByRole('button',{name:tab,exact:true}).click();assert.equal(await p.locator('[data-gauge="risk"]').count(),0);assert.ok(await p.getByText('Not assessed',{exact:true}).count());}
 await p.screenshot({path:out+'/missing-evidence.png',fullPage:true});
 await p.goto(base+'/after.html?critical=1');await ready();await p.getByRole('button',{name:'Liquidity & Safety',exact:true}).click();assert.ok(await p.locator('[role=alert]').count());await p.screenshot({path:out+'/critical-liquidity.png',fullPage:true});
 await p.locator('.ti-evidence>summary').click();assert.ok(await p.locator('.ti-evidence').getAttribute('open')!==null);await p.getByText('Evidence Intelligence · Blockchain Details',{exact:true}).click();
 await p.goto(base+'/after.html?save=1');await p.waitForURL('**/after.html?report=*');await ready();const savedUrl=p.url(),score=await p.locator('.ti-risk-number').textContent();await p.reload();await ready();assert.equal(p.url(),savedUrl);assert.equal(await p.locator('.ti-risk-number').textContent(),score);
 await ctx.grantPermissions(['clipboard-read','clipboard-write']);await p.getByRole('button',{name:'Copy full mint address'}).click();const copy=await p.evaluate(async()=>({copied:await navigator.clipboard.readText(),mint:document.querySelector('.g11-mint code')?.title}));assert.equal(copy.copied,copy.mint);assert.equal(errors.length,0);assert.equal(external.length,0);

}finally{
 const copy=await p.evaluate(async()=>({copied:await navigator.clipboard.readText(),mint:document.querySelector('.g11-mint code')?.title})).catch(()=>null);
 const report={rows,perf,errors,external,copy,providerCalls:external.length};fs.writeFileSync(dir+'/browser-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify({checks:rows.length,errors,external,perf,copy}));await b.close();server.close();
}
