import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiquidityReadController} from '../lib/liquidityReadController.mjs';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const response=(mint,value)=>({ok:true,json:async()=>({mint,status:'pools_reported',reportedLiquidityUsd:value})});
test('older same-mint success cannot restore evidence after newer failure',async()=>{
 const old=deferred(),fresh=deferred();let calls=0,state;const c=createLiquidityReadController({fetchImpl:()=>++calls===1?old.promise:fresh.promise,publish:s=>state=s});c.reset('mint');const a=c.read('mint'),b=c.read('mint');fresh.resolve({ok:false,json:async()=>({})});await b;old.resolve(response('mint',100));await a;assert.equal(state.data,null);assert.equal(state.loading,false);assert.ok(state.error);
});
test('newer success survives older completion; scope reset and disposal discard stale bodies',async()=>{
 let state;const jobs=[];const c=createLiquidityReadController({fetchImpl:()=>{const d=deferred();jobs.push(d);return d.promise;},publish:s=>state=s});c.reset('a');const a=c.read('a'),b=c.read('a');jobs[1].resolve(response('a',200));await b;jobs[0].resolve(response('a',100));await a;assert.equal(state.data.reportedLiquidityUsd,200);
 const old=c.read('a');c.reset('b');jobs[2].resolve(response('a',300));await old;assert.equal(state.data,null);await c.read('a');assert.equal(jobs.length,3);
 const late=c.read('b');c.reset('',true);jobs[3].resolve(response('b',400));await late;assert.equal(state.data,null);
});
test('body parsing timeout settles promptly and cannot restore stale estimate',async()=>{
 const body=deferred();let state;const c=createLiquidityReadController({timeoutMs:5,fetchImpl:async()=>({ok:true,json:()=>body.promise}),publish:s=>state=s});c.reset('a');await c.read('a');assert.equal(state.data,null);assert.equal(state.loading,false);assert.match(state.error,/timed out/);body.resolve({mint:'a',status:'pools_reported',reportedLiquidityUsd:100});await new Promise(r=>setImmediate(r));assert.equal(state.data,null);
});
test('wrong-mint response remains unavailable',async()=>{let state;const c=createLiquidityReadController({fetchImpl:async()=>response('wrong',100),publish:s=>state=s});c.reset('a');await c.read('a');assert.equal(state.data,null);assert.ok(state.error);});
