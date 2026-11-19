import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {adaptDashboardEvidence,liquidityAccountObservationAt} from '../lib/glitchDashboardEvidenceV11.mjs';
const now=1800000000000,mint='synthetic',iso=t=>new Date(t).toISOString();
const props=observedAt=>({result:{mint},workerEvidence:{version:'1.1',mint,liquidity:{mint,status:'account_checks_completed',observedAt,updatedAt:iso(now),checkedPoolCount:3,reportedPoolCount:3,failedBatchCount:0}}});
const adapt=(p,time=now)=>adaptDashboardEvidence({...p,now:time});
test('account counts reject old, absent, malformed and future observations despite recent persistence',()=>{
 for(const at of [iso(now-3600001),undefined,null,0,'invalid',iso(now+1)]){
  const result=adapt(props(at));assert.equal(result.liquidity,null);
  assert.equal(result.scores.liquidity_quality_safety.score,null);
  assert.ok(result.scores.liquidity_quality_safety.components.every(c=>c.points===null));
 }
});
test('fresh observations retain persistence metadata and exact existing inclusive expiry boundary',()=>{
 const p=props(iso(now-3600000)),saved=JSON.stringify(p);
 assert.equal(adapt(p).liquidity.checkedPoolCount,3);
 assert.equal(adapt(p).liquidity.updatedAt,iso(now));
 assert.equal(adapt(p,now+1).liquidity,null);
 assert.equal(JSON.stringify(p),saved);
 assert.equal(adapt(props(iso(now))).liquidity.checkedPoolCount,3);
});
// Execute the actual dashboard freshness effect, with deterministic hook/DOM/timer
// doubles. This checks scheduling, callback and cleanup; it is not a browser render.
const source=readFileSync(new URL('../app/GlitchV11Dashboard.jsx',import.meta.url),'utf8');
const start=source.indexOf(' const observedAt=');
const end=source.indexOf(' const [selected',start);
assert.ok(start>0&&end>start);
const effectSource=source.slice(start,end);
test('mounted expiry uses collection time, refreshes at expiry and removes timer/listener',()=>{
 const p=props(iso(now-3599990));let time=now,timer,cleanup,refreshes=0,cleared=false;const listeners=new Map();
 const context={liquidity:null,workerEvidence:p.workerEvidence,extensions:null,verifiedHolderEnvelope:null,clockRevision:0,liquidityAccountObservationAt,
  Date:{now:()=>time,parse:Date.parse},setTimeout:(fn,delay)=>{timer={fn,delay};return 7;},clearTimeout:id=>{cleared=id===7;},
  refreshClock:fn=>{assert.equal(fn(0),1);refreshes++;},useEffect:fn=>{cleanup=fn();},
  document:{visibilityState:'visible',addEventListener:(n,f)=>listeners.set(n,f),removeEventListener:(n,f)=>{assert.equal(listeners.get(n),f);listeners.delete(n);}}};
 vm.runInNewContext(effectSource,context);
 assert.equal(timer.delay,11);assert.equal(adapt(p,time).liquidity.checkedPoolCount,3);
 time+=10;assert.equal(adapt(p,time).liquidity.checkedPoolCount,3);
 time++;timer.fn();assert.equal(refreshes,1);assert.equal(adapt(p,time).liquidity,null);
 listeners.get('visibilitychange')();assert.equal(refreshes,2);
 cleanup();assert.equal(cleared,true);assert.equal(listeners.size,0);
});
test('invalid or expired collection times cannot schedule expiry from fresh storage time',()=>{
 for(const at of [undefined,'invalid','2026-02-30T00:00:00Z','2026-03-02T00:00:00',iso(now+1),iso(now-3600001)]){
  let cleanup;const context={liquidity:null,workerEvidence:props(at).workerEvidence,extensions:null,verifiedHolderEnvelope:null,clockRevision:0,liquidityAccountObservationAt,Date:{now:()=>now,parse:Date.parse},setTimeout:()=>assert.fail('unexpected timer'),clearTimeout:()=>{},refreshClock:()=>{},useEffect:fn=>{cleanup=fn();},document:{addEventListener:()=>{},removeEventListener:()=>{}}};
  vm.runInNewContext(effectSource,context);cleanup();
 }
});

test('strict account observation contract rejects normalized and ambiguous dates',()=>{
 const normalized=Date.parse('2026-03-02T00:00:00Z');
 for(const at of ['2026-02-30T00:00:00Z','2026-03-02T00:00:00','2026-03-02','2026-03-02T00:00:00+00:00','2026-03-02T00:00:00.0Z',false,{}]){
  assert.equal(liquidityAccountObservationAt({observedAt:at}),null);
  assert.equal(adapt(props(at),normalized).liquidity,null);
 }
 for(const at of ['2026-03-02T00:00:00Z','2026-03-02T00:00:00.000Z','2026-03-02T00:00:00.123Z']){
  assert.equal(liquidityAccountObservationAt({observedAt:at}),at);
  assert.equal(adapt(props(at),Date.parse(at)).liquidity.checkedPoolCount,3);
 }
});
