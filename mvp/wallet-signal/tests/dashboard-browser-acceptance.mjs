// Optional offline browser acceptance: use installed Playwright; all APIs are fixtures.
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out=process.env.DASHBOARD_QA_OUT || 'test-artifacts/dashboard-acceptance';
await fs.mkdir(out,{recursive:true});
const base=process.env.WALLET_SIGNAL_BASE_URL || 'http://127.0.0.1:3107';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname),'Local fixture QA only');
const mint='So11111111111111111111111111111111111111112';
const active='11111111111111111111111111111111';
const holders=[{ownerWallet:active,tokenAccount:'fixture-account-a',sharePct:12},{ownerWallet:mint,tokenAccount:'fixture-account-b',sharePct:8},{ownerWallet:'FixtureWalletC',tokenAccount:'fixture-account-c',sharePct:3}];
const groups=[{members:[active,mint],directEdges:[{walletA:active,walletB:mint,signatures:['synthetic-signature-only']}]}];
const report={commit:process.env.DASHBOARD_QA_COMMIT || 'local-working-tree',checks:[],issues:[],requests:[],externalBlocked:[],errors:[]};
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-background-networking']});
try {
for(const viewport of [{name:'mobile-320',width:320,height:800},{name:'mobile-393',width:393,height:852},{name:'desktop',width:1440,height:900}]) {
 const context=await browser.newContext({viewport,hasTouch:viewport.width<500,serviceWorkers:'block'});
 let authority={mintAuthority:null,freezeAuthority:null};
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin!==base){report.externalBlocked.push(url.href);return route.abort();}
  if(!url.pathname.startsWith('/api/'))return route.continue();
  report.requests.push({viewport:viewport.name,path:url.pathname,method:route.request().method()});
  const data={
   '/api/creator':{mint,tokenProgram:'spl-token',authorityDetailsStatus:'available',...authority},
   '/api/creator-evidence':{mint,status:'CACHE_MISS'},
   '/api/token-concentration':{mint,accounts:holders,top20TokenAccountSharePct:23},
   '/api/holder-scan-status':{status:'complete',jobId:'synthetic-only',scan:{mint,holders,connectedGroups:groups,directPairs:1,connectedWallets:2,scanStatus:'partial',historyComplete:false,updatedAt:new Date().toISOString()}},
   '/api/holder-assessment':{mint,assessment:null},
   '/api/scoring-evidence':{mint},
   '/api/token-liquidity':{mint,reportedLiquidityUsd:null}
  };
  if(!Object.hasOwn(data,url.pathname)){report.errors.push('Unexpected API blocked: '+url.pathname);return route.fulfill({status:503,json:{error:'Unexpected API blocked by offline QA'}});}
  return route.fulfill({status:200,json:data[url.pathname]});
 });
 const page=await context.newPage();
 page.on('pageerror',e=>report.errors.push(e.message));
 const check=(name,details={})=>report.checks.push({viewport:viewport.name,name,...details});
 try {
 await page.goto(base,{waitUntil:'networkidle'});
 await page.getByRole('tab',{name:'TOKEN ANALYSIS',exact:true}).click();
 await page.getByRole('textbox',{name:'Solana token mint address'}).fill(mint);
 const inspect=page.getByRole('button',{name:'INSPECT TOKEN',exact:true});
 const dashboard=page.getByRole('region',{name:'GLITCH Intelligence v1.1'});
 const label=name=>dashboard.locator('.g11-data article').filter({has:page.locator('.g11-kicker',{hasText:name})}).locator('strong');
 for(const fixture of [{name:'revoked',fields:{mintAuthority:null,freezeAuthority:null},expected:'Revoked'},{name:'active',fields:{mintAuthority:active,freezeAuthority:active},expected:'111111…11111'},{name:'empty',fields:{mintAuthority:'',freezeAuthority:''},expected:'Pending'},{name:'false',fields:{mintAuthority:false,freezeAuthority:false},expected:'Pending'},{name:'missing',fields:{},expected:'Pending'}]) {
  authority=fixture.fields;
  await inspect.click();
  await dashboard.waitFor();
  await inspect.waitFor();
  assert.equal(await label('Mint Authority').innerText(),fixture.expected);
  assert.equal(await label('Freeze Authority').innerText(),fixture.expected);
  assert.match(await dashboard.innerText(),/Overall Score: Pending/);
  check('authority '+fixture.name);
  if(['revoked','active','false'].includes(fixture.name))await dashboard.screenshot({path:`${out}/${viewport.name}-${fixture.name}.png`});
 }
 const nav=dashboard.getByRole('navigation',{name:'Attribute navigation'});
 for(let cycle=0;cycle<3;cycle++)for(const name of ['Token Security','Holder Intelligence','Creator Intelligence','Liquidity Quality & Safety']) {
  const button=nav.getByRole('button',{name,exact:true});await button.focus();await page.keyboard.press('Enter');
  assert.equal(await button.getAttribute('aria-current'),'page');
  assert.equal(await dashboard.locator('.g11-work h3').first().innerText(),name);
  assert.match(await dashboard.innerText(),/Final score: Pending/);
 }
 check('three keyboard navigation cycles through four panels');
 await dashboard.screenshot({path:`out/${viewport.name}-liquidity.png`.replace('out/',out+'/')});
 await nav.getByRole('button',{name:'Creator Intelligence',exact:true}).click();
 assert.match(await dashboard.innerText(),/Not independently verified/);
 check('creator unknown and uncalibrated scores explicit');
 await nav.getByRole('button',{name:'Holder Intelligence',exact:true}).click();
 await dashboard.getByRole('button',{name:'Connection map',exact:true}).click();
 const map=dashboard.getByRole('region',{name:'Holder connection bubble map'});
 await map.waitFor();
 assert.equal(await map.locator('circle[role=button]').count(),3);
 assert.match(await map.innerText(),/Not available for this snapshot/);
 await map.getByRole('checkbox',{name:'Connected wallets only'}).check();
 assert.equal(await map.locator('circle[role=button]').count(),2);
 await map.getByRole('button',{name:'Reset',exact:true}).click();
 await map.getByRole('combobox',{name:'Filter by connected cluster'}).selectOption('0');
 assert.equal(await map.locator('circle[role=button]').count(),2);
 await map.getByRole('button',{name:'Reset',exact:true}).click();
 await map.getByRole('button',{name:'Zoom in',exact:true}).click();
 assert.match(await map.locator('svg > g').getAttribute('transform'),/scale\(1.25\)/);
 await map.getByRole('button',{name:'Zoom out',exact:true}).click();
 await map.getByRole('button',{name:'Map legend & interpretation',exact:true}).click();
 assert.equal(await map.getByRole('button',{name:'Hide map legend'}).getAttribute('aria-expanded'),'true');
 const node=map.locator('circle[role=button]').first();
 await map.getByRole('button',{name:'Reset',exact:true}).focus();
 await page.keyboard.press('Tab');
 assert.equal(await node.evaluate(e=>e===document.activeElement),true,'Tab must reach first bubble');
 const focusStyle=await node.evaluate(e=>({outline:getComputedStyle(e).outlineStyle,outlineWidth:getComputedStyle(e).outlineWidth,stroke:getComputedStyle(e).stroke,strokeWidth:getComputedStyle(e).strokeWidth,focused:e===document.activeElement}));
 await page.screenshot({path:`${out}/${viewport.name}-map-keyboard-focus.png`,fullPage:true});
 await page.keyboard.press('Enter');
 assert.match(await map.innerText(),/Wallet #1/);
 await map.getByText('View transaction evidence',{exact:true}).click();
 assert.match(await map.innerText(),/Candidate — validation pending or unavailable/);
 await map.locator('circle[role=button]').nth(2).focus();await page.keyboard.press('Space');
 assert.match(await map.innerText(),/No direct relationships detected/);
 await map.locator('circle[role=button]').nth(1).click();
 assert.match(await map.innerText(),/Wallet #2/);
 if(viewport.width<500){await node.tap();assert.match(await map.innerText(),/Wallet #1/);}
 check('map filter, zoom, legend, Tab/Enter/Space and pointer selection and evidence disclosure',{focusStyle});
 if(focusStyle.outline==='none')report.issues.push({viewport:viewport.name,issue:'Bubble keyboard focus has no outline; static circle styling has no focus treatment',focusStyle});
 const metrics=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,dashboardWidth:document.querySelector('.g11').getBoundingClientRect().width,rootBoxSizing:getComputedStyle(document.querySelector('.g11')).boxSizing,rootPadding:getComputedStyle(document.querySelector('.g11')).padding,overflowElements:[...document.querySelectorAll('.g11,.g11 *')].filter(e=>e.getBoundingClientRect().right>innerWidth+2||e.getBoundingClientRect().left< -2).slice(0,15).map(e=>({tag:e.tagName,cls:e.className,x:e.getBoundingClientRect().x,right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width}))}));
 check('horizontal layout measurement',metrics);
 if(metrics.scrollWidth>metrics.width+2)report.issues.push({viewport:viewport.name,issue:'Page horizontal overflow',metrics});
 await page.screenshot({path:`${out}/${viewport.name}-map.png`,fullPage:true});
 await dashboard.getByRole('button',{name:'Open full screen'}).click();
 assert.equal(await dashboard.evaluate(e=>e.classList.contains('g11-full')),true);
 assert.equal(await dashboard.evaluate(e=>e.scrollWidth<=e.clientWidth+2),true,'Fullscreen content must fit without clipping');
 const fullscreen=await dashboard.evaluate(e=>({x:e.getBoundingClientRect().x,right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width,viewport:innerWidth,ancestors:(()=>{const a=[];for(let p=e;p;p=p.parentElement){const s=getComputedStyle(p);a.push({tag:p.tagName,cls:p.className,transform:s.transform,filter:s.filter,contain:s.contain,margin:s.margin,left:s.left,width:s.width});}return a;})()}));
 assert.ok(fullscreen.right<=fullscreen.viewport+2,'Fullscreen border box: '+JSON.stringify(fullscreen));
 await dashboard.screenshot({path:`${out}/${viewport.name}-fullscreen.png`});
 await dashboard.getByRole('button',{name:'Exit full screen'}).click();
 check('fullscreen enter and exit');
 await nav.getByRole('button',{name:'Token Security',exact:true}).click();
 assert.equal(await label('Mint Authority').innerText(),'Pending');
 check('return navigation retains unknown evidence');
 }catch(e){report.errors.push({viewport:viewport.name,message:e.stack});await page.screenshot({path:`${out}/${viewport.name}-failure.png`,fullPage:true});}
 await context.close();
}
}finally {await browser.close();await fs.writeFile(`${out}/results.json`,JSON.stringify(report,null,2));}
console.log(JSON.stringify({checks:report.checks.length,issues:report.issues,errors:report.errors,interceptedRequests:report.requests.length,externalBlocked:report.externalBlocked},null,2));
if(report.errors.length||report.issues.length)process.exitCode=1;
