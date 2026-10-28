// Run against an outbound-blocked local production build; all API traffic is mocked.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {mkdir} from 'node:fs/promises';
import {HOLDER_RETAIN19_POLICY as frozenPolicy} from '../lib/holderEligibleViewPolicy.mjs';
import {assessVerifiedHolderConcentration} from '../lib/verifiedHolderConcentrationAssessment.mjs';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const base=process.env.HOLDER_PAGE_BASE_URL||'http://127.0.0.1:3110';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('LOCAL_PAGE_ONLY');
const browser=await chromium.launch({headless:true,...(process.env.HOLDER_BROWSER_EXECUTABLE?{executablePath:process.env.HOLDER_BROWSER_EXECUTABLE}:{})});
const artifacts=process.env.HOLDER_PAGE_ARTIFACT_DIR||'/tmp/holder-page-artifacts';await mkdir(artifacts,{recursive:true});
const mintA='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump',mintB='7'.repeat(32),signature='2'.repeat(64);
const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const wallet=i=>'3'.repeat(30)+alphabet[Math.floor(i/58)]+alphabet[i%58];
const updatedAt=new Date().toISOString();
function fixture(mint){
 const holders=Array.from({length:20},(_,i)=>({ownerWallet:wallet(i),tokenAccount:wallet(i+20),amountRaw:'10',sharePct:1}));
 const cp={version:1,mint,holders,wallets:Object.fromEntries(holders.map(h=>[h.ownerWallet,{pages:1}])),snapshot:{supplyRaw:'1000',largestAccountsSlot:100,supplySlot:100,ownerSlots:Array(20).fill(100)},signatures:{[signature]:'checked'},edges:{[wallet(0)+'|'+wallet(1)]:{walletA:wallet(0),walletB:wallet(1),signatures:[signature]}}};
 const assessment=assessVerifiedHolderConcentration({checkpoint:cp,evidenceRows:[{signature,status:'verified',evidence:{pairs:[wallet(0)+'|'+wallet(1)]}}]});
 return {holders,assessment,scan:{mint,updatedAt,holders,connectedGroups:[{members:[wallet(0),wallet(1)],directEdges:[{walletA:wallet(0),walletB:wallet(1),signatures:[signature]}]}],directPairs:1,connectedWallets:2,transactionsChecked:1,scanStatus:'partial'},envelope:{mint,jobId:'job-'+mint,updatedAt,assessment}};
}
const wait=async predicate=>{for(let n=0;n<500;n++){if(await predicate())return;await delay(10);}throw Error('MOCK_REQUEST_TIMEOUT');};
let checks=0;
try{for(const width of [390,1280]){
 const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),page=await context.newPage();
 const forbidden=[],errors=[],pending=[],requests=[];let holdAssessments=true,holdStatus=false,emptyEvidence=false,frozenMode='valid',liquidityMode='error';const pendingStatus=[];
 page.on('pageerror',e=>errors.push(e.message));await page.clock.install({time:new Date(updatedAt)});
 const response=(route,body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
 await context.route('**/*',async route=>{
  const u=new URL(route.request().url()),pathname=u.pathname;
  if(u.origin!==new URL(base).origin){forbidden.push(u.origin);return route.abort();}
  if(!pathname.startsWith('/api/')){
   if(pathname==='/'||pathname.startsWith('/_next/')||pathname==='/doom404-mascot.png..jpeg'||pathname==='/favicon.ico')return route.continue();
   forbidden.push(pathname);return route.abort();
  }
  requests.push(pathname);
  if(route.request().method()!=='GET'||/start|worker|tick|scheduler|recovery|merge|live-holder/.test(pathname)){forbidden.push(pathname);return route.abort();}
  const mint=u.searchParams.get('mint'),f=fixture(mint);
  if(pathname==='/api/holder-frozen-observation'){
   const snapshot={id:frozenPolicy.snapshotId,mint:mintA,slot:frozenPolicy.slot,status:'frozen',supply_raw:'1000',excluded_wallets:['1nc1nerator11111111111111111111111111111111'],holder_ranking:[frozenPolicy.infrastructurePool,...Array.from({length:19},(_,i)=>wallet(i))].map(wallet=>({wallet,balance:'10'}))};
   if(frozenMode==='wrong')snapshot.slot++;
   return frozenMode==='error'?response(route,{status:'unavailable'},503):response(route,{mint,status:'observed_only',snapshot});
  }
  if(pathname==='/api/holder-assessment'){
   if(emptyEvidence)return response(route,{mint,status:'not_started'});
   if(holdAssessments){pending.push({route,mint});return;}
   return response(route,f.envelope);
  }
  if(pathname==='/api/creator')return response(route,{mint,tokenProgram:'spl-token',mintAuthority:null,freezeAuthority:null,authorityDetailsStatus:'parsed',mintOrigin:{coverage:{}}});
  if(pathname==='/api/creator-evidence')return response(route,{mint,status:'CACHE_MISS'});
  if(pathname==='/api/token-concentration')return response(route,{mint,accounts:f.holders,top20TokenAccountSharePct:20});
  if(pathname==='/api/holder-scan-status'&&emptyEvidence)return response(route,{mint,status:'not_started'});
  if(pathname==='/api/holder-scan-status'&&holdStatus){pendingStatus.push({route,mint});return;}
  if(pathname==='/api/holder-scan-status')return response(route,{status:'partial',jobId:'job-'+mint,scan:f.scan});
  if(pathname==='/api/scoring-evidence')return response(route,{mint});
  if(pathname==='/api/token-liquidity')return liquidityMode==='error'?response(route,{mint,status:'unavailable'},503):response(route,{mint,status:'pools_reported',observedAt:liquidityMode==='stale'?'2020-01-01T00:00:00Z':updatedAt,reportedLiquidityUsd:1234,poolCountReturned:2});
  forbidden.push(pathname);return route.abort();
 });
 await page.goto(base,{waitUntil:'networkidle'});
 await page.getByRole('tab',{name:'TOKEN ANALYSIS',exact:true}).click();
 const inspect=async mint=>{await page.getByRole('textbox',{name:'Solana token mint address'}).fill(mint);await page.getByRole('button',{name:'INSPECT TOKEN',exact:true}).click();await page.getByRole('button',{name:'Holder Intelligence',exact:true}).click();await page.getByRole('button',{name:'INSPECT TOKEN',exact:true}).waitFor();};
 await inspect(mintA);await wait(()=>pending.length===1);await page.getByText(/Loading Holder evidence/).waitFor();checks++;
 await page.clock.runFor(31000);await wait(()=>pending.length===2);
 await response(pending[1].route,{error:'offline provider error'},503);await page.getByText(/Holder evidence provider unavailable/).waitFor();
 await response(pending[0].route,fixture(mintA).envelope);await delay(150);
 const stale=await page.getByText(/Holder evidence provider unavailable/).count()===0;
 if(process.env.HOLDER_EXPECT_STALE==='1'){assert.equal(stale,true);console.log('REPRODUCED: older same-mint success overwrote newer provider error');await context.close();break;}
 assert.equal(stale,false,'older success must not erase newer failure');checks++;
 // Newer success wins over older failure, too.
 await page.clock.runFor(30000);await wait(()=>pending.length===3);await page.clock.runFor(30000);await wait(()=>pending.length===4);
 await response(pending[3].route,fixture(mintA).envelope);await page.getByRole('button',{name:'Connection map',exact:true}).click();await page.getByText(/1 verified pairs/).waitFor();
 await response(pending[2].route,{error:'old error'},503);await delay(100);assert.equal(await page.getByText(/Holder evidence provider unavailable/).count(),0);checks++;
 // A slow older success cannot replace a newer success either.
 await page.clock.runFor(30000);await wait(()=>pending.length===5);await page.clock.runFor(30000);await wait(()=>pending.length===6);
 const fresh=fixture(mintA).envelope;fresh.assessment.status='fresh_refresh';await response(pending[5].route,fresh);await page.getByText(/Assessment: fresh refresh/).waitFor();
 const staleSuccess=fixture(mintA).envelope;staleSuccess.assessment.status='stale_refresh';await response(pending[4].route,staleSuccess);await delay(100);await page.getByText(/Assessment: fresh refresh/).waitFor();checks++;
 // An old-mint success cannot replace the newer mint's failure.
 holdStatus=true;await page.clock.runFor(30000);await wait(()=>pending.length===7);await wait(()=>pendingStatus.length===1);holdStatus=false;await inspect(mintB);await wait(()=>pending.length===8);
 await response(pending[7].route,{error:'new mint error'},503);await page.getByText(/Holder evidence provider unavailable/).waitFor();
 await response(pending[6].route,fixture(mintA).envelope);await response(pendingStatus[0].route,{status:'partial',jobId:'job-'+mintA,scan:fixture(mintA).scan});await delay(100);
 assert.equal(await page.getByRole('button',{name:'Connection map',exact:true}).count(),1,'old mint history cannot replace current map');await page.getByText(/Holder evidence provider unavailable/).waitFor();assert.equal(await page.getByText(/original ranking 20; eligible view 19/).count(),0);checks++;
 // Unmount while pending; the response must not contaminate a fresh return.
 await page.clock.runFor(30000);await wait(()=>pending.length===9);await page.getByRole('tab',{name:'WALLET ANALYSIS',exact:true}).click();
 await response(pending[8].route,fixture(mintB).envelope);holdAssessments=false;
 await page.getByRole('tab',{name:'TOKEN ANALYSIS',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Holder Intelligence',exact:true}).count(),0);
 await inspect(mintA);await page.getByRole('button',{name:'Connection map',exact:true}).click();await page.getByText(/1 verified pairs/).waitFor();checks++;
 for(let n=0;n<3;n++){await page.getByRole('button',{name:'Overview',exact:true}).click();await page.getByRole('button',{name:'Connection map',exact:true}).click();}
 const node=page.getByRole('button',{name:/Wallet .*observed supply/}).first();await page.keyboard.press('Tab');await node.focus();assert.notEqual(await node.evaluate(e=>getComputedStyle(e).outlineStyle),'none','keyboard focus is visible');await page.keyboard.press('Enter');await page.getByText('View transaction evidence',{exact:true}).click();await page.locator('li').filter({hasText:'Verified transfer'}).waitFor();
 assert.equal(await page.locator('a[href*="solscan.io/tx/"]').count(),1);assert.equal(await node.getAttribute('aria-pressed'),'true');
  const second=page.getByRole('button',{name:/Wallet .*observed supply/}).nth(1);await second.focus();await page.keyboard.press('Space');assert.equal(await second.getAttribute('aria-pressed'),'true');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'actual page must fit viewport');
 assert.ok(await page.locator('img').count()>0,'original mascot remains');await page.screenshot({path:`${artifacts}/page-${width}.png`,fullPage:true});
 await page.getByTestId('frozen-concentration').waitFor();assert.match(await page.getByTestId('frozen-concentration').innerText(),/20%.*19%.*1000/);checks++;
 frozenMode='wrong';await inspect(mintB);await inspect(mintA);await delay(100);assert.equal(await page.getByTestId('frozen-concentration').count(),0);await page.getByText(/matching frozen raw inputs are unavailable/).waitFor();checks++;
 frozenMode='error';await inspect(mintB);await inspect(mintA);await delay(100);assert.equal(await page.getByTestId('frozen-concentration').count(),0);checks++;
 emptyEvidence=true;await inspect(mintB);await page.getByText(/Historical coverage and wallet independence remain Unknown/).waitFor();assert.equal(await page.getByRole('button',{name:'Connection map',exact:true}).count(),0);checks++;
 liquidityMode='reported';await inspect(mintA);await page.getByRole('button',{name:'Liquidity Quality & Safety',exact:true}).click();await page.getByText('$1,234',{exact:true}).waitFor();checks++;
 liquidityMode='error';await inspect(mintA);await page.getByRole('button',{name:'Liquidity Quality & Safety',exact:true}).click();await page.getByText(/Liquidity provider unavailable; estimates withheld/).waitFor();assert.equal(await page.getByText('$1,234',{exact:true}).count(),0);checks++;
 liquidityMode='stale';await inspect(mintA);await page.getByRole('button',{name:'Liquidity Quality & Safety',exact:true}).click();assert.equal(await page.getByText('$1,234',{exact:true}).count(),0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));await page.screenshot({path:`${artifacts}/liquidity-${width}.png`,fullPage:true});checks++;
 assert.deepEqual(forbidden,[]);assert.deepEqual(errors,[]);assert.ok(requests.length>0);checks++;await context.close();
 }
 console.log(JSON.stringify({passed:true,checks,artifacts,mode:process.env.HOLDER_EXPECT_STALE==='1'?'reproduction':'regression'}));
}finally{await browser.close();}
