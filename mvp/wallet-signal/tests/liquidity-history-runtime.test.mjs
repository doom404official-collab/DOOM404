import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createLiquidityHistoryDeadline,createLiquidityHistoryPublisher} from '../lib/liquidityHistoryRuntime.mjs';
import {assessAutomaticHistoryCheckpoint} from '../lib/liquidityAutomaticHistoryGate.mjs';
const pool='11111111111111111111111111111111',a='1'.repeat(64),b='2'.repeat(64),c='3'.repeat(64);
const prior={schemaVersion:1,pool,before:a,seen:[a],events:[{signature:a,classification:'UNVERIFIED_CANDIDATE',authorizationVerified:false,operation:'retained synthetic observation'}],errors:[{stage:'transaction',message:'retained'}],pages:2,requestCount:10,pendingSignatures:[],complete:false,historyCoverageVerified:false,authorizationVerified:false,withdrawalVerified:false,finalScore:null,classification:'AMOUNT_RECONCILED_AUTHORIZATION_PENDING',reconciliation:{verifiedDistinct:34,recoveredPending:2,sourceDigest:'a'.repeat(64)},stopReason:'CHECKPOINTED'};
async function cli(mode,{source=prior,duration=1000,missing=false}={}){
 const dir=await fs.mkdtemp(join(tmpdir(),'liquidity-runtime-'));
 try{
  const input=join(dir,'input.json'),output=join(dir,'output.json'),mock=join(dir,'mock.mjs');await fs.writeFile(input,JSON.stringify(source));
  await fs.writeFile(mock,`let calls=0;global.fetch=async(url,o)=>{calls++;const q=JSON.parse(o.body);if(q.method==='getSignaturesForAddress')return {ok:true,json:async()=>({result:[{signature:'${b}',slot:123},{signature:'${c}',slot:123}]})};if(q.params[0]==='${c}'&&'${mode}'!=='resume'){if('${mode}'==='abort')process.kill(process.pid,'SIGTERM');if('${mode}'==='malformed')return {ok:true,json:async()=>({})};if('${mode}'==='fallback'&&url==='https://offline.invalid')throw Error('offline');return {ok:true,json:()=>new Promise(()=>{})};}return {ok:true,json:async()=>({result:{slot:123,transaction:{signatures:[q.params[0]],message:{instructions:[]}},meta:{err:null,innerInstructions:[]}}})};};process.on('exit',()=>console.log('CALLS='+calls));`);
  const child=spawnSync(process.execPath,['--import',mock,new URL('../scripts/liquidity-historical-investigator.mjs',import.meta.url).pathname],{encoding:'utf8',timeout:5000,env:{PATH:process.env.PATH,GLITCH_LIQUIDITY_POOL:pool,HELIUS_RPC_URL:'https://offline.invalid',ALCHEMY_RPC_URL:mode==='fallback'?'https://fallback.invalid':'',GLITCH_HISTORY_CHECKPOINT:missing?'':input,GLITCH_HISTORY_OUTPUT:output,GLITCH_HISTORY_BUDGET:'4',GLITCH_HISTORY_DURATION_MS:String(duration)}});
  assert.equal(child.signal,null,child.stderr);let next=null;try{next=JSON.parse(await fs.readFile(output,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  assert.deepEqual(JSON.parse(await fs.readFile(input,'utf8')),source);
  return {next,status:child.status,stderr:child.stderr,calls:Number(child.stdout.match(/CALLS=(\d+)/)?.[1])};
 }finally{await fs.rm(dir,{recursive:true,force:true});}
}
test('missing or invalid source fails closed without requests or output',async()=>{
 for(const options of [{missing:true},{source:{...prior,pool:'wrong'}},{source:{...prior,before:null}},{source:{...prior,requestCount:-1}},{source:{...prior,complete:true}},{source:{...prior,seen:[{}]}}]){const r=await cli('resume',options);assert.notEqual(r.status,0);assert.equal(r.calls,0);assert.equal(r.next,null);}
});
for(const mode of ['abort','stall','malformed','fallback'])test('actual CLI preserves paid validated progress on '+mode,async()=>{
 const r=await cli(mode,{duration:1000});assert.equal(r.status,1,r.stderr);assert.deepEqual(r.next.seen,[a,b]);assert.deepEqual(r.next.events,prior.events);assert.deepEqual(r.next.errors.slice(0,1),prior.errors);assert.equal(r.next.before,a);assert.equal(r.next.requestCount,10+r.calls);assert.equal(r.next.complete,false);assert.equal(r.next.historyCoverageVerified,false);assert.equal(r.next.stopReason,'RETRIEVAL_INCOMPLETE');assert.notEqual(assessAutomaticHistoryCheckpoint(r.next,pool).action,'CONTINUE_BOUNDED');assert.ok(r.calls<=4);if(mode==='fallback')assert.equal(r.calls,4);
});
test('repeated explicit interrupted resume preserves prefix and errors without re-fetching validated transaction',async()=>{
 const first=await cli('abort');const second=await cli('abort',{source:first.next});assert.deepEqual(second.next.seen,first.next.seen);assert.deepEqual(second.next.errors.slice(0,first.next.errors.length),first.next.errors);assert.equal(second.calls,2);assert.equal(second.next.requestCount,first.next.requestCount+2);
});
test('deadline rejects before dispatch and settles non-cooperative operations',async()=>{
 let calls=0;const pre=createLiquidityHistoryDeadline({signal:AbortSignal.abort()});await assert.rejects(pre.run(()=>calls++));assert.equal(calls,0);
 const runtime=createLiquidityHistoryDeadline({requestMs:5});await assert.rejects(runtime.run(()=>new Promise(()=>{})),/DEADLINE/);await assert.rejects(runtime.run(()=>calls++));assert.equal(calls,0);
 let clock=0;const cpu=createLiquidityHistoryDeadline({now:()=>clock});await assert.rejects(cpu.run(async()=>{clock=480001;return true;}),/DEADLINE/);
});
test('local publisher excludes overlap and retains prior whole file on write failure; no retry',async()=>{
 const dir=await fs.mkdtemp(join(tmpdir(),'liquidity-publish-')),output=join(dir,'out.json');
 try{
  const writer=await createLiquidityHistoryPublisher(output);await assert.rejects(createLiquidityHistoryPublisher(output));await writer.save(prior);await writer.close();await assert.rejects(createLiquidityHistoryPublisher(output),/ALREADY_EXISTS/);
  const other=join(dir,'failed.json');let renames=0;
  const broken=await createLiquidityHistoryPublisher(other,{fs:{...fs,rename:async()=>{renames++;throw Error('uncertain');}}});await assert.rejects(broken.save(prior),/RECONCILIATION/);await assert.rejects(broken.save(prior),/RECONCILIATION/);await broken.close();assert.equal(renames,1);assert.deepEqual(JSON.parse(await fs.readFile(output,'utf8')),prior);assert.deepEqual(JSON.parse(await fs.readFile(other+'.pending','utf8')),prior);await fs.access(other+'.lock');
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('timed-out local write cannot perform a late rename or retry',async()=>{
 const dir=await fs.mkdtemp(join(tmpdir(),'liquidity-late-')),output=join(dir,'out.json');let release,renames=0;
 const stall=new Promise(r=>release=r);
 try{
  const wrapped={...fs,open:async(path,flags)=>{const handle=await fs.open(path,flags);if(path.endsWith('.pending'))return {writeFile:async body=>{await stall;return handle.writeFile(body);},sync:()=>handle.sync(),close:()=>handle.close()};return handle;},rename:async(...args)=>{renames++;return fs.rename(...args);}};
  const writer=await createLiquidityHistoryPublisher(output,{fs:wrapped,timeoutMs:5});await assert.rejects(writer.save(prior),/RECONCILIATION/);release();await new Promise(r=>setTimeout(r,20));assert.equal(renames,0);await assert.rejects(writer.save(prior));await writer.close();await fs.access(output+'.lock');
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('rename response uncertainty retains quarantine even when whole output exists',async()=>{
 const dir=await fs.mkdtemp(join(tmpdir(),'liquidity-rename-')),output=join(dir,'out.json');let renames=0;
 try{
  const writer=await createLiquidityHistoryPublisher(output,{fs:{...fs,rename:async(...args)=>{renames++;await fs.rename(...args);throw Error('lost outcome');}}});
  const interim={...prior,stopReason:'RETRIEVAL_INCOMPLETE'};
  await assert.rejects(writer.save(interim),/RECONCILIATION/);await assert.rejects(writer.save(interim));await writer.close();assert.equal(renames,1);assert.equal(assessAutomaticHistoryCheckpoint(JSON.parse(await fs.readFile(output,'utf8')),pool).action,'PAUSE_EVIDENCE_ERROR');await fs.access(output+'.lock');
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
