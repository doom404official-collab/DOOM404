// Production stylesheet with synthetic scanning markup; no application/API calls.
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('playwright');
const source=readFileSync(new URL('../app/page.js',import.meta.url),'utf8');
const css=[...source.matchAll(/<style>\{`([\s\S]*?)`\}<\/style>/g)].map(x=>x[1]).join('\n');
assert.ok(css.includes('doom-mascot--scanning .doom-mascot__beam'));
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium'});
let requests=0,checks=0;
try{
 for(const width of [320,1440]){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
  await context.route('**/*',route=>{requests++;return route.abort();});
  const page=await context.newPage();
  await page.setContent('<style>'+css+'</style><div class="doom-mascot doom-mascot--scanning"><div class="doom-mascot__image"></div><div class="doom-mascot__beam" aria-hidden="true"></div></div><div class="doom-scan-indeterminate"></div>');
  // Switching preference back must restore ordinary branding animations.
  for(const reducedMotion of ['no-preference','reduce','no-preference']){
   await page.emulateMedia({reducedMotion});
   const actual=await page.evaluate(()=>({
    names:['.doom-mascot__image','.doom-mascot__beam','.doom-scan-indeterminate'].map(s=>getComputedStyle(document.querySelector(s)).animationName),
    beamOpacity:getComputedStyle(document.querySelector('.doom-mascot__beam')).opacity
   }));
   assert.deepEqual(actual.names,reducedMotion==='reduce'?['none','none','none']:['doom-float','doom-scan','doom-scan-progress']);checks++;
   assert.equal(actual.beamOpacity,'1');checks++;
  }
  await context.close();
 }
 assert.equal(requests,0);
 console.log(JSON.stringify({passed:true,checks,networkRequests:requests,scope:'production CSS; synthetic markup; not device or hosted acceptance'}));
}finally{await browser.close();}
