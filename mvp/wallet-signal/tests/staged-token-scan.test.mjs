import test from 'node:test';import assert from 'node:assert/strict';
import {runStagedTokenScan} from '../lib/stagedTokenScan.mjs';
import {parseServerTiming,scanRequestTiming} from '../lib/scanTiming.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const result={mint,tokenProgram:'spl-token',authorityDetailsStatus:'available',mintAuthority:null,freezeAuthority:null,supplyRaw:'1000'};
const concentration={mint,sampledWalletObservation:{version:2,atomicSubset:true,eligibleWallets:1,observedAt:new Date().toISOString(),supplyRaw:'1000',wallets:[{wallet:'wallet',amountRaw:'10'}],observedSharePct:1,largestSharePct:1,contextSlots:{mint:1,sampledAccounts:1}}};
function adapter(overrides={}){const calls=[];return {calls,read:async path=>{calls.push(path);const route=path.split('?')[0];if(Object.hasOwn(overrides,route))return typeof overrides[route]==='function'?overrides[route](path):overrides[route];if(route==='/api/token-current')return result;if(route==='/api/token-concentration')return concentration;if(route==='/api/token-liquidity')return {mint,pools:[{pairAddress:'pool'}]};if(route==='/api/current-liquidity')return {mint,observation:{mint,version:2,executableDepth:{verified:true}}};if(route==='/api/token-investigation')return {mint,status:'investigation_completed',creator:{creator:'creator'}};if(route==='/api/current-creator')return {version:2,mint,creator:'creator',status:'verified_current_wallet'};return {mint};}};}
test('current investigations start together and initial report is not gated by history',async()=>{
 const held=deferred(),initial=deferred(),a=adapter({'/api/token-investigation':()=>held.promise}),updates=[];
 const run=runStagedTokenScan({mint,read:a.read,onInitial:s=>{initial.resolve(s);},onUpdate:s=>updates.push(s)});
 const first=await initial.promise;
 assert.equal(first.result.mint,mint);assert.ok(first.investigationProgress.pending.length>0);assert.equal(a.calls.some(p=>p.startsWith('/api/token-investigation')),false);
 await new Promise(r=>setImmediate(r));assert.ok(a.calls.some(p=>p.startsWith('/api/token-investigation')));
 assert.ok(a.calls.findIndex(p=>p.startsWith('/api/current-liquidity'))<a.calls.findIndex(p=>p.startsWith('/api/token-investigation')));
 held.resolve({mint,status:'investigation_completed',creator:{creator:'creator'}});const final=await run;
 assert.equal(final.investigationProgress.stage,'bounded_complete');assert.equal(final.investigationProgress.historyComplete,false);
 assert.ok(final.inspectionTiming.boundedReportMs>=first.inspectionTiming.initialReportMs);
 assert.equal(a.calls.filter(p=>p.startsWith('/api/current-creator')).length,1,'same fresh current creator is reused');
 assert.equal(a.calls.filter(p=>p.includes('extend=1')).length,1);
});
test('a verified critical mint publishes before a slow holder/history dependency',async()=>{
 const holders=deferred(),initial=deferred();
 // Mint authority is high, not critical; use verified freeze control only doesn't
 // manufacture a critical. A Token-2022 permanent delegate has an explicit proof.
 const ext={mint,verified:true,observedAt:new Date().toISOString(),configuration:{version:2,slot:1,commitment:'finalized',mintAuthority:null,freezeAuthority:null,permissions:{delegate:'6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC'},unknownExtensions:[],extensionTypes:['permanentDelegate'],scope:'mint'},transferFee:{status:'not_observed'}};
 const b=adapter({'/api/token-current':{...result,tokenProgram:'spl-token-2022',currentExtensions:ext},'/api/token-concentration':()=>holders.promise});
 const run=runStagedTokenScan({mint,read:b.read,onInitial:s=>initial.resolve(s)});const first=await initial.promise;
 assert.equal(first.investigationProgress.decisionReady,true);assert.equal(first.concentration,null);
 holders.resolve(concentration);await run;
});
test('missing dynamic liquidity is never relabelled decision ready',async()=>{
 const a=adapter({'/api/token-liquidity':{mint,pools:[]}});const final=await runStagedTokenScan({mint,read:a.read});
 assert.equal(final.currentLiquidity,null);assert.equal(final.investigationProgress.decisionReady,false);assert.equal(final.inspectionTiming.decisionReadyMs,undefined);
});
test('provider failures remain explicit and do not erase verified mint data',async()=>{
 const a=adapter({'/api/token-concentration':()=>{throw Error('provider unavailable');}});const final=await runStagedTokenScan({mint,read:a.read,initialBudgetMs:5});
 assert.equal(final.result.mint,mint);assert.ok(final.investigationProgress.unavailable.includes('holder_classification'));assert.equal(final.concentration,null);
});
test('abort prevents later cross-token evidence publication',async()=>{
 const late=deferred(),a=adapter({'/api/token-current':()=>late.promise}),controller=new AbortController(),updates=[];
 const run=runStagedTokenScan({mint,read:a.read,signal:controller.signal,onUpdate:s=>updates.push(s)});controller.abort();late.resolve(result);await assert.rejects(run,{name:'AbortError'});
 assert.equal(updates.some(s=>s.result),false);
});
test('timing trace sanitizes route and server labels and never records URL credentials',()=>{
 assert.deepEqual(parseServerTiming('admission;dur=8.25,provider;dur=14;desc="rpc"'),[{name:'admission',durationMs:8.25},{name:'provider',durationMs:14,description:'rpc'}]);
 assert.deepEqual(parseServerTiming('https://secret.example/key;dur=2,query;dur=-1'),[]);
 const r=scanRequestTiming({path:'/api/token-current?mint=private',startedAt:1,headersAt:5,finishedAt:9,response:new Response('{}',{headers:{'Server-Timing':'db;dur=3','X-Glitch-Admission-Cache':'HIT'}})});
 assert.equal(r.route,'/api/token-current');assert.equal(r.totalMs,8);assert.equal(r.cache,'durable_hit');assert.doesNotMatch(JSON.stringify(r),/private/);
});

test('malformed or stale holder observations cannot declare decision-ready evidence',async()=>{
 for(const sample of [{...concentration.sampledWalletObservation,wallets:[]},{...concentration.sampledWalletObservation,observedAt:'2020-01-01T00:00:00Z'}]){
  const a=adapter({'/api/token-concentration':{mint,sampledWalletObservation:sample}}),r=await runStagedTokenScan({mint,read:a.read,initialBudgetMs:1});assert.equal(r.investigationProgress.decisionReady,false);assert.equal(r.inspectionTiming.decisionReadyMs,undefined);
 }
});
test('hung transports terminate at the total pipeline deadline without late publication',async()=>{
 const a=adapter({'/api/token-investigation':()=>new Promise(()=>{})});let initial=false;
 const started=Date.now();await assert.rejects(runStagedTokenScan({mint,read:a.read,completionBudgetMs:30,onInitial:()=>{initial=true;}}),{name:'AbortError'});assert.equal(initial,true);assert.ok(Date.now()-started<1000);
});
test('initial and deep source concurrency stays below the existing eight-lease ceiling',async()=>{
 const {createScanReadScheduler}=await import('../lib/scanReadScheduler.mjs');let active=0,max=0;const held=[];
 const read=createScanReadScheduler({read:async path=>{active++;max=Math.max(max,active);await new Promise(r=>held.push(r));active--;return path;}});
 const work=Array.from({length:12},(_,i)=>read('/api/source-'+i));await new Promise(r=>setImmediate(r));assert.equal(max,6);
 for(let i=0;i<2;i++){for(const done of held.splice(0))done();await new Promise(r=>setImmediate(r));}
 for(const done of held.splice(0))done();await Promise.all(work);assert.equal(max,6);
});
