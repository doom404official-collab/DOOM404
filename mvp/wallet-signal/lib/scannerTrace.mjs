import {AsyncLocalStorage} from 'node:async_hooks';
import {performance} from 'node:perf_hooks';
import {randomUUID} from 'node:crypto';
const storage=new AsyncLocalStorage();
let processRequestIndex=0;
const safe=name=>typeof name==='string'&&/^[a-z][a-z0-9_]{0,63}$/.test(name)?name:'other';
const rounded=n=>Math.round(Math.max(0,n)*100)/100;
/** Diagnostic spans contain fixed operation names only, never input addresses,
 * provider URLs, credentials, client identity or transaction bodies. Durations
 * overlap for concurrent operations and must not be added as critical-path time. */
export async function traceSpan(name,operation){
 const ctx=storage.getStore();if(!ctx)return operation();
 const start=performance.now();try{return await operation();}
 finally{const elapsed=performance.now()-start,key=safe(name),row=ctx.spans[key]||(ctx.spans[key]={count:0,totalMs:0,maxMs:0});row.count++;row.totalMs+=elapsed;row.maxMs=Math.max(row.maxMs,elapsed);}
}
export function traceEvent(name){const ctx=storage.getStore();if(ctx){const key=safe(name);ctx.events[key]=(ctx.events[key]||0)+1;}}
export async function withScannerTrace(route,operation,{log=console.info}={}){
 const ctx={version:1,traceId:randomUUID(),route:safe(route.replaceAll('-','_')),processRequestIndex:++processRequestIndex,spans:{},events:{}};
 const start=performance.now();
 return storage.run(ctx,async()=>{
  let response;
  try{response=await operation();return response;}
  finally{
   const snapshot={...ctx,totalMs:rounded(performance.now()-start),firstRequestInProcess:ctx.processRequestIndex===1,
    coldStartScope:'First request in this process only; platform initialization before handler is not measured.',spans:Object.fromEntries(Object.entries(ctx.spans).map(([k,v])=>[k,{count:v.count,totalMs:rounded(v.totalMs),maxMs:rounded(v.maxMs)}]))};
   if(response?.headers){response.headers.set('X-Glitch-Trace-Id',ctx.traceId);response.headers.set('X-Glitch-Process-First-Request',String(snapshot.firstRequestInProcess));response.headers.set('Server-Timing',[`scanner_total;dur=${snapshot.totalMs}`,...Object.entries(snapshot.spans).slice(0,28).map(([k,v])=>`${k};dur=${v.totalMs}`)].join(', '));}
   log('GLITCH_SCANNER_TRACE',JSON.stringify(snapshot));
  }
 });
}
