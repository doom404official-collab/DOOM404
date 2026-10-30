import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {buildHistoricalReplayPlan} from '../lib/liquidityHistoricalReplayPlan.mjs';
import {assessAutomaticHistoryCheckpoint} from '../lib/liquidityAutomaticHistoryGate.mjs';
import {createLiquidityHistoryPublisher} from '../lib/liquidityHistoryRuntime.mjs';
const pool='11111111111111111111111111111111',a='1'.repeat(64),b='2'.repeat(64);
const source={schemaVersion:1,pool,before:b,seen:[a,b],events:[],pendingSignatures:[],errors:[{stage:'historical',message:'retained'}],complete:false,classification:'AMOUNT_RECONCILED_AUTHORIZATION_PENDING'};
async function run(mode,{patch={},alias,selected}={}){
 const dir=await fs.mkdtemp(join(tmpdir(),'replay-runtime-'));
 try{
  const input=join(dir,'source.json'),planPath=join(dir,'plan.json'),output=join(dir,'output.json'),mock=join(dir,'mock.mjs');
  const plan={...buildHistoricalReplayPlan(source,{pool,maxSignatures:2}),...patch};if(selected)plan.signaturesToReplay=selected;
  await fs.writeFile(input,JSON.stringify(source));await fs.writeFile(planPath,JSON.stringify(plan));
  if(alias==='symlink')await fs.symlink(input,output);if(alias==='hardlink')await fs.link(input,output);if(alias==='plan')await fs.symlink(planPath,output);
  await fs.writeFile(mock,`let calls=0;global.fetch=async(url,o)=>{if(url!=='https://offline.invalid')throw Error('UNEXPECTED_DESTINATION');calls++;const q=JSON.parse(o.body);if(q.method!=='getTransaction')throw Error('UNEXPECTED_METHOD');const sig=q.params[0];if(sig==='${b}'&&'${mode}'!=='success'){if('${mode}'==='abort')process.kill(process.pid,'SIGTERM');if('${mode}'==='rate')return {ok:false,status:429};if('${mode}'==='malformed')return {ok:true,json:async()=>({})};return {ok:true,json:()=>new Promise(()=>{})};}return {ok:true,json:async()=>({result:{slot:123,transaction:{signatures:[sig],message:{instructions:[]}},meta:{err:null,innerInstructions:[]}}})};};process.on('exit',()=>console.log('CALLS='+calls));`);
  const child=spawnSync(process.execPath,['--import',mock,new URL('../scripts/liquidity-historical-replay-executor.mjs',import.meta.url).pathname],{encoding:'utf8',timeout:5000,env:{PATH:process.env.PATH,GLITCH_LIQUIDITY_POOL:pool,GLITCH_HISTORY_REPLAY_PLAN:planPath,GLITCH_HISTORY_CHECKPOINT:mode==='missing'?'':input,GLITCH_HISTORY_REPLAY_EVIDENCE:output,HELIUS_RPC_URL:'https://offline.invalid',GLITCH_HISTORY_REPLAY_BUDGET:'3',GLITCH_REPLAY_DURATION_MS:'1000'}});
  assert.equal(child.signal,null,child.stderr);assert.deepEqual(JSON.parse(await fs.readFile(input,'utf8')),source);assert.deepEqual(JSON.parse(await fs.readFile(planPath,'utf8')),plan);
  let report=null;if(!alias)try{report=JSON.parse(await fs.readFile(output,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  return {report,calls:Number(child.stdout.match(/CALLS=(\d+)/)?.[1]),status:child.status,stderr:child.stderr,plan};
 }finally{await fs.rm(dir,{recursive:true,force:true});}
}
for(const mode of ['abort','stall','malformed','rate'])test('actual replay preserves diagnostic prefix on '+mode,async()=>{
 const r=await run(mode);assert.equal(r.status,1,r.stderr);assert.equal(r.report.status,'PARTIAL_UNRESOLVED');assert.deepEqual(r.report.transactions.map(t=>t.signature),[a]);assert.equal(r.report.sourceDigest,r.plan.sourceDigest);assert.equal(r.report.requests,r.calls);assert.ok(r.calls<=3);assert.equal(r.report.finalScore,null);assert.equal(r.report.authorizationVerified,false);assert.equal(r.report.originalCheckpointPreserved,true);assert.throws(()=>assessAutomaticHistoryCheckpoint(r.report,pool));
});
test('successful replay remains a non-promotable diagnostic',async()=>{const r=await run('success');assert.equal(r.status,0,r.stderr);assert.equal(r.calls,2);assert.equal(r.report.status,'REPLAY_BATCH_COMPLETE');assert.deepEqual(r.report.transactions.map(t=>t.signature),[a,b]);assert.throws(()=>assessAutomaticHistoryCheckpoint(r.report,pool));});
test('explicit separately narrowed plan preserves source; failed output is not an automatic resume source',async()=>{await run('abort');const r=await run('abort',{selected:[b]});assert.equal(r.calls,1);assert.deepEqual(r.report.transactions,[]);assert.equal(r.report.sourceDigest,r.plan.sourceDigest);});
test('missing, mismatched and duplicate replay plans fail before transport',async()=>{
 for(const [mode,options] of [['missing',{}],['success',{patch:{sourceDigest:'0'.repeat(64)}}],['success',{patch:{signaturesToReplay:[a,a]}}]]){const r=await run(mode,options);assert.notEqual(r.status,0);assert.equal(r.calls,0);assert.equal(r.report,null);}
});
for(const alias of ['symlink','hardlink','plan'])test('replay source/output '+alias+' collision fails before requests',async()=>{const r=await run('success',{alias});assert.notEqual(r.status,0);assert.equal(r.calls,0);});
test('publisher rechecks output under lock after a cooperating writer wins the preexistence race',async()=>{
 const dir=await fs.mkdtemp(join(tmpdir(),'publisher-race-')),output=join(dir,'out.json');let once=false;
 try{
  const stale={...fs,lstat:async path=>{if(path===output&&!once){once=true;const missing=await fs.lstat(path).catch(error=>error);const winner=await createLiquidityHistoryPublisher(output);await winner.save({winner:true});await winner.close();throw missing;}return fs.lstat(path);}};
  await assert.rejects(createLiquidityHistoryPublisher(output,{fs:stale}),/REQUIRES_REVIEW/);assert.deepEqual(JSON.parse(await fs.readFile(output,'utf8')),{winner:true});
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('stale local lock and pending file are preserved, never reclaimed automatically',async()=>{
 const dir=await fs.mkdtemp(join(tmpdir(),'publisher-stale-'));
 try{for(const suffix of ['.lock','.pending']){const output=join(dir,suffix.slice(1)+'.json');await fs.writeFile(output+suffix,'retained');await assert.rejects(createLiquidityHistoryPublisher(output));assert.equal(await fs.readFile(output+suffix,'utf8'),'retained');}}
 finally{await fs.rm(dir,{recursive:true,force:true});}
});
