import test from 'node:test';import assert from 'node:assert/strict';
import {createTokenInvestigationStore} from '../lib/tokenInvestigationStore.mjs';
const mint='EMQGeopasoZZUqiPDErvSL1QqvGr5WfZ1hbcvmAf8C3Y';
const env={SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fixture'};
test('algorithm upgrade expires only exact completed prior snapshot before existing lease claim',async()=>{
 const calls=[],store=createTokenInvestigationStore({env,fetchImpl:async(url,init)=>{calls.push({url,init});return new Response(null,{status:204});}}),previous={mint,status:'complete',updated_at:'2026-11-28T10:00:00.123Z',observation:{investigationRevision:4,events:['preserve']}};
 const saved=structuredClone(previous);assert.equal(await store.expirePriorRevision(mint,previous),true);assert.equal(calls.length,1);
 const {url,init}=calls[0];assert.equal(init.method,'PATCH');const u=new URL(url);assert.equal(u.searchParams.get('mint'),'eq.'+mint);assert.equal(u.searchParams.get('status'),'eq.complete');assert.equal(u.searchParams.get('updated_at'),'eq.'+previous.updated_at);assert.deepEqual(JSON.parse(init.body),{expires_at:'1970-01-01T00:00:00.000Z'});assert.deepEqual(previous,saved);
});
test('current revisions, running workers, mismatched rows and malformed CAS dates never expire',async()=>{
 let calls=0;const store=createTokenInvestigationStore({env,fetchImpl:async()=>{calls++;throw Error('no');}});
 for(const previous of [{mint,status:'complete',updated_at:'2026-11-28',observation:{investigationRevision:12}},{mint,status:'running',updated_at:'2026-11-28',observation:{investigationRevision:4}},{mint:'wrong',status:'complete',updated_at:'2026-11-28'},{mint,status:'complete',updated_at:'invalid'}])assert.equal(await store.expirePriorRevision(mint,previous),false);assert.equal(calls,0);
});
test('failed revision invalidation fails closed rather than skipping the durable claim',async()=>{
 const store=createTokenInvestigationStore({env,fetchImpl:async()=>new Response('',{status:403})});await assert.rejects(store.expirePriorRevision(mint,{mint,status:'complete',updated_at:'2026-11-28',observation:{investigationRevision:4}}),/STORE_UNAVAILABLE/);
});
test('post-worker report read uses a distinct bounded phase without changing the admission route',async()=>{
 const {runStagedTokenScan}=await import('../lib/stagedTokenScan.mjs');const {replay}=await import('./fixtures/ui-assessment-replay.mjs');const r=replay(),seen=[];
 const out=await runStagedTokenScan({mint:r.result.mint,read:async path=>{seen.push(path);const route=path.split('?')[0];if(route==='/api/token-current')return r.result;if(route==='/api/scoring-evidence')return {...r.workerEvidence,readPhase:path.includes('phase=bounded_final')?'post_worker':'initial'};if(route==='/api/token-investigation')return {mint:r.result.mint,status:'investigation_completed'};if(route==='/api/current-creator')return r.currentCreator;if(route==='/api/creator-evidence')return r.creatorEvidence;return {mint:r.result.mint};}});
 const reads=seen.filter(x=>x.startsWith('/api/scoring-evidence?'));assert.equal(reads.length,2);assert.notEqual(reads[0],reads[1]);assert.equal(out.workerEvidence.readPhase,'post_worker');assert.equal(new URL(reads[1],'https://fixture').pathname,'/api/scoring-evidence');
});

test('RI75 revision6 partial intelligence expires for corrected history decoder without removing receipts',async()=>{
 const calls=[],store=createTokenInvestigationStore({env,fetchImpl:async(url,init)=>{calls.push({url,init});return new Response(null,{status:204});}}),previous={mint,status:'complete',updated_at:'2026-11-28T10:00:00Z',observation:{investigationRevision:6,transactionCache:[{signature:'immutable'}]}};
 assert.equal(await store.expirePriorRevision(mint,previous),true);assert.equal(calls.length,1);assert.deepEqual(JSON.parse(calls[0].init.body),{expires_at:'1970-01-01T00:00:00.000Z'});assert.equal(previous.observation.transactionCache.length,1);
});
