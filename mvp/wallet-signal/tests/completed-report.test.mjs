import test from 'node:test';
import assert from 'node:assert/strict';
import {saveReport,loadReport} from '../lib/completedReport.mjs';
function database(){const rows=new Map();globalThis.indexedDB={open(){const r={};queueMicrotask(()=>{r.result={close(){},transaction(){const tx={objectStore(){return {put(value,id){rows.set(id,structuredClone(value));queueMicrotask(()=>tx.oncomplete());},get(id){const request={};queueMicrotask(()=>{request.result=rows.get(id);request.onsuccess();});return request;}};}};return tx;}};r.onsuccess();});return r;}};return rows;}
test('completed reports isolate sequential mints and reload without fetch',async()=>{
 database();let fetches=0;globalThis.fetch=()=>{fetches++;throw Error('Unexpected provider request');};
 const a=await saveReport({result:{mint:'A'},workerEvidence:{risk:'critical'}}),b=await saveReport({result:{mint:'B'}});
 assert.notEqual(a,b);assert.equal((await loadReport(a)).result.mint,'A');assert.equal((await loadReport(b)).result.mint,'B');assert.equal((await loadReport(a)).workerEvidence.risk,'critical');assert.equal(fetches,0);
});
test('missing, malformed and mismatched saved report identities fail closed',async()=>{
 const rows=database();assert.equal(await loadReport('../A'),null);const id=crypto.randomUUID();assert.equal(await loadReport(id),null);rows.set(id,{version:1,mint:'A',props:{result:{mint:'B'}}});assert.equal(await loadReport(id),null);
});
