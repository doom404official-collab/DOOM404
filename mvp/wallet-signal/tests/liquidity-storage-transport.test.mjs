import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {liquidityStorageRequest,validateLiquidityStorage} from '../lib/liquidityStorageTransport.mjs';
import {persistLiquidityCheckpoint} from '../lib/liquidityCheckpointStore.mjs';
import {appendLiquiditySnapshot} from '../lib/liquiditySnapshotArchive.mjs';
const evidence={mint:'98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump',status:'partial',observedAt:'2026-10-18T07:00:00Z',pools:[],batchErrors:[],finalScore:null,verifiedDepth:false,lpSecurityVerified:false};
const config={url:'https://example.supabase.co',serviceRoleKey:'offline'};
const pending=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
test('invalid storage and pre-cancelled writes perform no transport',async()=>{
 let calls=0;const fetchImpl=async()=>{calls++;return {ok:true};};
 for(const url of ['http://example.test','https://x.test/path','https://user:secret@x.test','https://x.test?secret=x'])assert.throws(()=>validateLiquidityStorage({...config,url}));
 for(const write of [persistLiquidityCheckpoint,appendLiquiditySnapshot]){
  await assert.rejects(write(evidence,{...config,signal:AbortSignal.abort(),fetchImpl}),e=>e.requestDispatched===false&&e.reconciliationRequired===false);
  await assert.rejects(write(evidence,{...config,timeoutMs:12001,fetchImpl}));
 }
 assert.equal(calls,0);
});
test('late write after deadline remains uncertain and never retried',async()=>{
 for(const write of [persistLiquidityCheckpoint,appendLiquiditySnapshot]){
  let calls=0;const late=pending();
  await assert.rejects(write(evidence,{...config,timeoutMs:5,fetchImpl:()=>{calls++;return late.promise;}}),e=>/OUTCOME_UNKNOWN/.test(e.message)&&e.reconciliationRequired&&e.retries===0);
  late.resolve({ok:true});await new Promise(r=>setImmediate(r));assert.equal(calls,1);
 }
});
test('parent cancellation settles non-cooperative writes and redacts transport errors',async()=>{
 const controller=new AbortController();let calls=0;
 const write=persistLiquidityCheckpoint(evidence,{...config,signal:controller.signal,fetchImpl:()=>{calls++;controller.abort();return new Promise(()=>{});}});
 await assert.rejects(write,e=>e.reconciliationRequired===true);assert.equal(calls,1);
 await assert.rejects(appendLiquiditySnapshot(evidence,{...config,fetchImpl:()=>{throw Error('secret endpoint');}}),e=>e.reconciliationRequired&&!e.message.includes('secret'));
});
test('cancelled reads cannot parse late bodies; long body parsing cannot succeed',async()=>{
 const late=pending();let parses=0;
 const read=liquidityStorageRequest('https://offline.invalid',{}, {timeoutMs:5,json:true,fetchImpl:()=>late.promise});
 await assert.rejects(read,e=>e.reconciliationRequired===false);late.resolve({ok:true,json:()=>{parses++;return [];}});await new Promise(r=>setImmediate(r));assert.equal(parses,0);
 let clock=0;await assert.rejects(liquidityStorageRequest('https://offline.invalid',{}, {json:true,now:()=>clock,fetchImpl:async()=>({ok:true,json:async()=>{clock=12001;return [];}})}),/TIMEOUT/);
});
test('stage-1 missing storage fails before any provider transport',()=>{
 const child=spawnSync(process.execPath,['--input-type=module','-e',"global.fetch=()=>{throw Error('UNEXPECTED_PROVIDER_CALL')};await import('./scripts/liquidity-evidence-worker.mjs')"],{cwd:new URL('..',import.meta.url),encoding:'utf8',env:{PATH:process.env.PATH,GLITCH_PREVIEW_URL:'https://offline.vercel.app',GLITCH_LIQUIDITY_MINT:evidence.mint}});
 assert.notEqual(child.status,0);assert.match(child.stderr,/LIQUIDITY_STORAGE_NOT_CONFIGURED/);assert.doesNotMatch(child.stderr,/UNEXPECTED_PROVIDER_CALL/);
});

test('actual stage-1 worker preserves local artifact and stops after uncertain snapshot write',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'liquidity-uncertain-')),output=join(dir,'evidence.json');
 try{
  const code=`let calls=[];global.fetch=async(url,options={})=>{const path=new URL(url).pathname;calls.push(path);if(path==='/api/token-liquidity')return Response.json({pools:[],poolCountReturned:0});if(path==='/rest/v1/liquidity_evidence_checkpoints'&&options.method!=='POST')return Response.json([]);if(path==='/rest/v1/liquidity_evidence_snapshots')throw Error('transport lost');throw Error('UNEXPECTED_CALL');};try{await import('./scripts/liquidity-evidence-worker.mjs');process.exitCode=2;}catch(e){console.log(JSON.stringify({message:e.message,reconciliationRequired:e.reconciliationRequired,calls}));}`;
  const child=spawnSync(process.execPath,['--input-type=module','-e',code],{cwd:new URL('..',import.meta.url),encoding:'utf8',env:{PATH:process.env.PATH,GLITCH_PREVIEW_URL:'https://offline.vercel.app',GLITCH_LIQUIDITY_MINT:evidence.mint,GLITCH_EVIDENCE_OUTPUT:output,SUPABASE_URL:config.url,SUPABASE_SERVICE_ROLE_KEY:config.serviceRoleKey}});
  assert.equal(child.status,0,child.stderr);const receipt=JSON.parse(child.stdout.trim());assert.equal(receipt.reconciliationRequired,true);assert.match(receipt.message,/OUTCOME_UNKNOWN/);assert.equal(receipt.calls.length,3);const saved=JSON.parse(await readFile(output,'utf8'));assert.equal(saved.finalScore,null);assert.equal(saved.poolInventoryComplete,false);
 }finally{await rm(dir,{recursive:true,force:true});}
});
