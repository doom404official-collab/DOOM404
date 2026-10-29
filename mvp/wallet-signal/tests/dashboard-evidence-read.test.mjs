import test from 'node:test';
import assert from 'node:assert/strict';
import {readDashboardEvidenceResponse as read} from '../lib/dashboardEvidenceRead.mjs';
import {createLiquidityReadController} from '../lib/liquidityReadController.mjs';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
for(const stage of ['headers','body'])test(`scoring ${stage} stall cancels and late resolution cannot publish`,async()=>{
 const late=deferred();let calls=0,parses=0,signal;
 const response={ok:true,json:()=>{parses++;return stage==='body'?late.promise:{mint:'m'};}};
 const pending=read('m',{timeoutMs:5,fetchImpl:async(u,o)=>{calls++;signal=o.signal;return stage==='headers'?late.promise:response;}});
 await assert.rejects(pending,/UNAVAILABLE/);assert.equal(signal.aborted,true);late.resolve(stage==='headers'?response:{mint:'m'});await new Promise(r=>setImmediate(r));assert.equal(calls,1);assert.equal(parses,stage==='headers'?0:1);
});
test('scoring preabort performs zero fetches; wrong identity and failure are redacted',async()=>{
 const controller=new AbortController();controller.abort();let calls=0;
 await assert.rejects(read('m',{signal:controller.signal,fetchImpl:()=>calls++}));assert.equal(calls,0);
 for(const fetchImpl of [async()=>({ok:true,json:async()=>({mint:'other'})}),async()=>({ok:false,json:async()=>({mint:'m'})})])await assert.rejects(read('m',{fetchImpl}),/UNAVAILABLE/);
});
test('parent inspection abort cancels Liquidity; same-mint successor excludes late body',async()=>{
 const old=deferred(),states=[];let calls=0,oldSignal;
 const reader=createLiquidityReadController({publish:s=>states.push(s),fetchImpl:async(u,o)=>{calls++;if(calls===1){oldSignal=o.signal;return {ok:true,json:()=>old.promise};}return {ok:true,json:async()=>({mint:'m',status:'pools_reported',reportedLiquidityUsd:2})};}});
 const controller=new AbortController();reader.reset('m');const pending=reader.read('m',{signal:controller.signal});await new Promise(r=>setImmediate(r));controller.abort();await pending;assert.equal(oldSignal.aborted,true);reader.reset('m');await reader.read('m');old.resolve({mint:'m',status:'pools_reported',reportedLiquidityUsd:999});await new Promise(r=>setImmediate(r));assert.equal(states.at(-1).data.reportedLiquidityUsd,2);assert.equal(states.some(s=>s.data?.reportedLiquidityUsd===999),false);
});
