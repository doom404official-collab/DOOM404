import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {makeScannerAdmission,trustedScannerClient} from '../lib/scannerAdmission.mjs';
import {guardedProviderFetch,classifyScannerProvider} from '../lib/scannerProviderGuard.mjs';
import {scannerContext,ScannerDenied} from '../lib/scannerRequestContext.mjs';
import {createScannerQuotaStore} from '../lib/scannerQuotaStore.mjs';
const env={VERCEL:'1',VERCEL_PROJECT_ID:'prj_AbsbiTw8Kc8axGpZ3FFpH9VvDS4e',VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'integration/glitch-app-main-20261118',VERCEL_GIT_COMMIT_SHA:'a'.repeat(40),SUPABASE_SERVICE_ROLE_KEY:'fixture-secret',SUPABASE_URL:'https://fixture.supabase.co'};
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const request=(query='mint='+mint,ip='203.0.113.10')=>new Request('https://fixture.invalid/api/token-current?'+query,{headers:{'x-vercel-forwarded-for':ip}});
function fixture(overrides={}){const calls=[];const store={admit:async args=>{calls.push(['admit',args]);return {status:'ADMITTED',lease:args.p_id,deadlineMs:1000};},debit:async args=>{calls.push(['debit',args]);return {status:'ADMITTED'};},finish:async args=>{calls.push(['finish',args]);return true;},...overrides};return {calls,store,run:makeScannerAdmission({env,store,reportUsage:(fn,r)=>fn(r)})};}
test('trusted identity rejects arbitrary forwarded headers off-platform and coalesces IPv6 /64',()=>{
 assert.throws(()=>trustedScannerClient(request(),{...env,VERCEL:'0'}),/TRUSTED_EDGE/);
 assert.throws(()=>trustedScannerClient(new Request('https://fixture.invalid',{headers:{'x-real-ip':'1.2.3.4','x-client-id':'abc'}}),env),/TRUSTED_EDGE/);
 assert.equal(trustedScannerClient(request('', '2001:db8:1234:5678::1'),env),trustedScannerClient(request('', '2001:db8:1234:5678:abcd::9'),env));
 assert.equal(trustedScannerClient(request('', '::ffff:203.0.113.10'),env),trustedScannerClient(request(),env));
 assert.notEqual(trustedScannerClient(request(),env),trustedScannerClient(request('', '203.0.113.11'),env));
});
test('invalid mint returns 400 without admission or providers',async()=>{const h=fixture();let n=0;const r=await h.run(request('mint=invalid'),()=>{n++;},'token-current');assert.equal(r.status,400);assert.equal(n,0);assert.equal(h.calls.length,0);});
test('permitted request debits before provider and preserves response observations',async()=>{
 const h=fixture(),order=[];h.store.debit=async a=>{order.push('debit');return {status:'ADMITTED'};};
 const r=await h.run(request(),async()=>{await guardedProviderFetch(async()=>{order.push('provider');return Response.json({result:1});},'https://solana-mainnet.g.alchemy.com/v2/fixture',{body:JSON.stringify({jsonrpc:'2.0',method:'getAccountInfo'})});return Response.json({mint,observedAt:'2026-11-26T05:23:00Z'});},'token-current');
 assert.equal(r.status,200);assert.deepEqual(order,['debit','provider']);assert.equal((await r.json()).observedAt,'2026-11-26T05:23:00Z');assert.equal(h.calls.at(-1)[0],'finish');
});
test('cached response avoids provider execution and reports zero provider work',async()=>{const h=fixture({admit:async()=>({status:'CACHED',httpStatus:200,body:{mint,observedAt:'2026-11-26T05:23:00Z'}})});let n=0;const r=await h.run(request(),()=>{n++;},'token-current');assert.equal(n,0);assert.equal(r.headers.get('X-Glitch-Rpc-Requests'),'0');assert.equal(r.headers.get('X-Glitch-Admission-Cache'),'HIT');assert.equal((await r.json()).observedAt,'2026-11-26T05:23:00Z');});
test('quota, duplicate, and concurrent denial return 429 with retry guidance',async()=>{for(const status of ['RATE_LIMIT','DUPLICATE','CONCURRENT_LIMIT']){const h=fixture({admit:async()=>({status,retryAfter:7})});let n=0;const r=await h.run(request(),()=>n++,'token-current');assert.equal(r.status,429);assert.equal(r.headers.get('Retry-After'),'7');assert.equal(n,0);}});
test('store outage and malformed admission fail closed before providers',async()=>{for(const admit of [async()=>{throw Error('private-fixture-detail');},async()=>({status:'ADMITTED',lease:'wrong',deadlineMs:1})]){const h=fixture({admit});let n=0;const r=await h.run(request(),()=>n++,'token-current');assert.equal(r.status,503);assert.equal(n,0);assert.doesNotMatch(await r.text(),/private-fixture-detail/);}});
test('swallowed provider quota errors still override partial handler success',async()=>{const h=fixture({debit:async()=>({status:'PROVIDER_BUDGET',retryAfter:17})});let providers=0;const r=await h.run(request(),async()=>{try{await guardedProviderFetch(async()=>providers++,'https://mainnet.helius-rpc.com/',{body:JSON.stringify({jsonrpc:'2.0',method:'getTransaction'})});}catch{}return Response.json({status:'partial'});},'token-current');assert.equal(r.status,429);assert.equal(r.headers.get('Retry-After'),'17');assert.equal(providers,0);});
test('deadline aborts admitted work and prohibits late provider calls after lease release',async()=>{const h=fixture({admit:async a=>({status:'ADMITTED',lease:a.p_id,deadlineMs:10})});let ctx,providers=0;const r=await h.run(request(),async()=>{ctx=scannerContext.getStore();await new Promise(resolve=>setTimeout(resolve,30));await guardedProviderFetch(async()=>providers++,'https://provider.invalid/');return Response.json({});},'token-current');assert.equal(r.status,503);assert.equal(ctx.closed,true);await new Promise(resolve=>setTimeout(resolve,40));assert.equal(providers,0);});
test('provider failures consume an attempt but do not disclose credentials',async()=>{const h=fixture();const r=await h.run(request(),async()=>{await guardedProviderFetch(async()=>{throw Error('secret-in-fixture');},'https://provider.invalid/',{});return Response.json({});},'token-current');assert.equal(r.status,503);assert.equal(h.calls.filter(x=>x[0]==='debit').length,1);assert.equal(r.headers.get('X-Glitch-Provider-Http-Requests'),'1');assert.doesNotMatch(await r.text(),/secret-in-fixture/);});
test('no admitted context can make an outbound provider call',async()=>{let n=0;await assert.rejects(guardedProviderFetch(async()=>n++,'https://provider.invalid/'),/UNADMITTED/);assert.equal(n,0);});
test('unauthorized workers reject before admission',async()=>{const h=fixture();const r=await h.run(new Request('https://fixture.invalid/api/holder-scan-worker',{method:'POST',body:'{}'}),()=>{throw Error('executed');},'holder-scan-worker');assert.equal(r.status,401);assert.equal(h.calls.length,0);});
test('finish RPC boolean is accepted and HTTP store failure remains closed',async()=>{const store=createScannerQuotaStore({env,fetchImpl:async()=>Response.json(true)});assert.equal(await store.finish({}),true);const bad=createScannerQuotaStore({env,fetchImpl:async()=>new Response('denied',{status:403})});await assert.rejects(bad.admit({}),/QUOTA_STORE_UNAVAILABLE/);});
test('all API routes have admission wrappers and independent policy entries',()=>{
 const routes=fs.readdirSync(new URL('../app/api',import.meta.url),{recursive:true}).filter(x=>x.endsWith('route.js'));const sql=fs.readdirSync(new URL('../db/migrations/',import.meta.url)).filter(x=>x.endsWith('.sql')).map(x=>fs.readFileSync(new URL('../db/migrations/'+x,import.meta.url),'utf8')).join('\n');
 for(const route of routes){const code=fs.readFileSync(new URL('../app/api/'+route,import.meta.url),'utf8');assert.match(code,/return withScannerAdmission\(request,async/);assert.ok(sql.includes("('"+route.replace('/route.js','')+"',"),route);}
});

test('privileged job assessment cannot escape auth through shared cache',async()=>{const h=fixture({admit:async()=>{throw Error('must not reach cache');}});const r=await h.run(request('mint='+mint+'&jobId=9c184d9a-2659-408a-a304-000000000002'),()=>Response.json({private:'job'}),'holder-assessment');assert.equal(r.status,401);assert.equal(h.calls.length,0);});
