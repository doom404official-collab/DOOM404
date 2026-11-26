import test from 'node:test';import assert from 'node:assert/strict';
const previous=globalThis.fetch;
globalThis.fetch=async()=>Response.json({jsonrpc:'2.0',result:null});
const {withProviderUsage}=await import('../lib/providerUsage.mjs');
const send=(method,url='https://private-provider.invalid/SECRET')=>fetch(url,{method:'POST',body:JSON.stringify({jsonrpc:'2.0',id:1,method,params:[]})});
test('concurrent request counts remain isolated, batch calls differ from HTTP attempts and no secrets escape',async()=>{
 const handler=n=>request=>withProviderUsage(async()=>{for(let i=0;i<n;i++)await send('getAccountInfo');return Response.json({ok:true});},request);
 const [a,b]=await Promise.all([handler(2)(new Request('https://scanner.invalid/api/one')),handler(1)(new Request('https://scanner.invalid/api/two'))]);
 assert.equal(a.headers.get('X-Glitch-Rpc-Requests'),'2');assert.equal(b.headers.get('X-Glitch-Rpc-Requests'),'1');assert.ok(a.headers.get('X-Glitch-Usage-Id'));assert.ok(!JSON.stringify([...a.headers]).includes('SECRET'));
 const batch=await withProviderUsage(async()=>{await fetch('https://rpc.invalid',{method:'POST',body:JSON.stringify([{jsonrpc:'2.0',method:'getSlot'},{jsonrpc:'2.0',method:'getEpochInfo'}])});return Response.json({});},new Request('https://scanner.invalid/api/batch'));
 assert.equal(batch.headers.get('X-Glitch-Rpc-Requests'),'1');assert.equal(batch.headers.get('X-Glitch-Rpc-Calls'),'2');
});
