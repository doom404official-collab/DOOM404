import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {runHolderActionsRecovery,validateHolderActionsRecovery} from '../lib/holderActionsRecovery.mjs';
import {createHolderHistoryCheckpoint} from '../lib/holderHistoryCheckpoint.mjs';
const sha='a'.repeat(40),ids=['c670f393-31b0-470c-a01f-cb2b813a1219','d07c0256-b472-4089-a237-99ed5e5c8cc4'],mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const config=()=>({HOLDER_MANUAL_MODE:'recovery',GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REPOSITORY:'doom404official-collab/DOOM404',GITHUB_REF:'refs/heads/fix/glitch-recovery-preflight-20261027',GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:sha,HOLDER_EXPECTED_SHA:sha,GLITCH_HOLDER_RECOVERY_START_AT:new Date(Date.now()-1000).toISOString(),GLITCH_HOLDER_RECOVERY_EXPIRES_AT:new Date(Date.now()+600000).toISOString(),GLITCH_HOLDER_RECOVERY_JOB_C670_VERSION:'7',GLITCH_HOLDER_RECOVERY_JOB_D07_VERSION:'11',SUPABASE_URL:'https://acwmtobcbpkjfqiatyke.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fake-private-key',HELIUS_RPC_URL:'https://mainnet.helius-rpc.com/?api-key=fake-private-provider'});
function transport(){
 const rows=new Map(ids.map((id,i)=>[id,{id,mint,version:i===0?7:11,status:'partial',lease_owner:null,lease_expires_at:null,summary:{score:9.93},checkpoint:createHolderHistoryCheckpoint({mint,holders:Array.from({length:20},(_,n)=>({ownerWallet:'wallet'+n,tokenAccount:'account'+n,sharePct:1}))})}]));
 for(const row of rows.values()){row.checkpoint.signatures.prior='checked';for(let n=0;n<100;n++)row.checkpoint.signatures['pending'+n]='pending';}
 const state={rows,calls:[],claims:0,provider:0,mode:'normal'};
 state.fetch=async(url,o)=>{
  assert.equal(o.redirect,'error');assert.ok(o.signal instanceof AbortSignal);const u=new URL(url);state.calls.push(u.pathname);
  if(u.hostname==='mainnet.helius-rpc.com'){state.provider++;if(state.mode==='provider-failure')throw Error('PRIVATE_PROVIDER_URL');const m=JSON.parse(o.body).method;assert.ok(['getTransaction','getSignaturesForAddress'].includes(m));return Response.json({jsonrpc:'2.0',id:JSON.parse(o.body).id,result:m==='getTransaction'?null:[]});}
  assert.equal(u.hostname,'acwmtobcbpkjfqiatyke.supabase.co');
  let result;
  if(o.method==='GET'){
   assert.equal(u.pathname,'/rest/v1/glitch_holder_scan_jobs');const row=rows.get(u.searchParams.get('id').slice(3));result=row?[structuredClone(row)]:[];
  }else{
   const b=JSON.parse(o.body),r=rows.get(b.p_job_id);assert.ok(r);
   if(u.pathname.endsWith('/glitch_claim_holder_scan')){state.claims++;if(r.lease_owner)return Response.json(null);Object.assign(r,{version:r.version+1,status:'running',lease_owner:b.p_worker,lease_expires_at:new Date(Date.now()+90000).toISOString()});result=r;}
   else if(u.pathname.endsWith('/glitch_renew_holder_scan')){assert.equal(b.p_expected_version,r.version);r.version++;result=r;}
   else if(u.pathname.endsWith('/glitch_commit_holder_scan')){assert.equal(b.p_expected_version,r.version);Object.assign(r,{version:r.version+1,status:b.p_status,checkpoint:b.p_checkpoint,summary:b.p_summary,lease_owner:null,lease_expires_at:null});if(state.mode==='lost-commit')throw Error('PRIVATE_SERVICE_KEY');result=r;}
   else assert.fail('Unexpected mutation');
  }
  return Response.json(result);
 };
 return state;
}
const run=(env,t,extra={})=>runHolderActionsRecovery({env,checkedOutSha:sha,fetchImpl:t.fetch,sleep:async()=>{},...extra});
for(const [key,value] of [
 ['HOLDER_MANUAL_MODE','disabled'],['HOLDER_MANUAL_MODE',undefined],['GITHUB_ACTIONS','false'],['GITHUB_EVENT_NAME','push'],['GITHUB_REPOSITORY','other/repository'],['GITHUB_REF','refs/heads/main'],['GITHUB_RUN_ATTEMPT','2'],['HOLDER_EXPECTED_SHA',undefined],['HOLDER_EXPECTED_SHA','b'.repeat(40)],['GITHUB_SHA','b'.repeat(40)],
 ['SUPABASE_URL','https://wrong.supabase.co'],['SUPABASE_URL','https://acwmtobcbpkjfqiatyke.supabase.co.evil.invalid'],['SUPABASE_URL','https://acwmtobcbpkjfqiatyke.supabase.co/?secret=x'],['SUPABASE_SERVICE_ROLE_KEY',undefined],['SUPABASE_SERVICE_ROLE_KEY',''],['HELIUS_RPC_URL',undefined],['HELIUS_RPC_URL','https://devnet.helius-rpc.com/?api-key=x'],['HELIUS_RPC_URL','http://mainnet.helius-rpc.com/?api-key=x'],['HELIUS_RPC_URL','https://mainnet.helius-rpc.com/?api-key=x&api-key=y'],['HELIUS_RPC_URL','https://mainnet.helius-rpc.com/'],
 ['GLITCH_HOLDER_RECOVERY_START_AT',undefined],['GLITCH_HOLDER_RECOVERY_EXPIRES_AT',undefined],['GLITCH_HOLDER_RECOVERY_JOB_C670_VERSION','8.1'],['GLITCH_HOLDER_RECOVERY_JOB_D07_VERSION',undefined]
])test('configuration blocks before network: '+key+' '+String(value),async()=>{
 const t=transport(),r=await run({...config(),[key]:value},t);assert.equal(r.status,'blocked');assert.equal(r.stopReason,'CONFIGURATION_FAILED');assert.equal(r.reconciliationRequired,false);assert.deepEqual(t.calls,[]);assert.equal(r.requestCount,0);
});
test('checked-out SHA, future/expired/oversized window and wrong sealed version fail closed',async()=>{
 for(const mutate of [e=>e.GLITCH_HOLDER_RECOVERY_START_AT=new Date(Date.now()+60000).toISOString(),e=>e.GLITCH_HOLDER_RECOVERY_EXPIRES_AT=new Date(Date.now()-1).toISOString(),e=>e.GLITCH_HOLDER_RECOVERY_EXPIRES_AT=new Date(Date.now()+1200001).toISOString()]){const e=config(),t=transport();mutate(e);assert.equal((await run(e,t)).status,'blocked');assert.deepEqual(t.calls,[]);}
 const t=transport();assert.equal((await run(config(),t,{checkedOutSha:'b'.repeat(40)})).status,'blocked');assert.deepEqual(t.calls,[]);
 const e=config();e.GLITCH_HOLDER_RECOVERY_JOB_D07_VERSION='12';assert.equal((await run(e,t)).stopReason,'PREFLIGHT_FAILED');assert.equal(t.claims,0);assert.equal(t.provider,0);
});
test('both preflights precede mutations; each actual adapter runs once,20 calls each/40 total',async()=>{
 const e=config(),t=transport(),before=structuredClone([...t.rows.values()]);const r=await run(e,t);
 assert.equal(r.status,'attempts_finished');assert.equal(r.requestCount,40);assert.equal(t.provider,40);assert.equal(t.claims,2);assert.deepEqual(t.calls.slice(0,2),['/rest/v1/glitch_holder_scan_jobs','/rest/v1/glitch_holder_scan_jobs']);
 assert.deepEqual(r.jobs.map(j=>[j.jobId,j.expectedVersion,j.resultVersion,j.requestCount]),[[ids[0],7,10,20],[ids[1],11,14,20]]);
 for(const row of t.rows.values()){assert.equal(row.checkpoint.signatures.prior,'checked');assert.equal(row.summary.score,9.93);}
 assert.equal(r.historyComplete,false);assert.equal(r.scorePromoted,false);assert.equal(r.retries,0);
 const json=JSON.stringify(r);for(const text of ['fake-private','api-key','supabase.co','checkpoint','pending0','wallet0'])assert.ok(!json.includes(text));assert.deepEqual(before.map(x=>x.version),[7,11]);
 const again=await run(e,t);assert.equal(again.status,'blocked');assert.equal(t.provider,40);assert.equal(t.claims,2);
});
test('lost first commit response stops second job and produces no secrets/checkpoints',async()=>{
 const t=transport();t.mode='lost-commit';const second=JSON.stringify(t.rows.get(ids[1]));const r=await run(config(),t);
 assert.equal(r.status,'stopped');assert.equal(r.stopReason,'RECONCILIATION_REQUIRED');assert.equal(r.jobs.length,1);assert.equal(r.jobs[0].status,'COMMIT_OUTCOME_UNKNOWN');assert.equal(r.reconciliationRequired,true);assert.equal(r.requestCount,20);assert.equal(t.claims,1);assert.equal(JSON.stringify(t.rows.get(ids[1])),second);assert.ok(!JSON.stringify(r).includes('PRIVATE'));assert.equal(t.rows.get(ids[0]).version,10);
});
test('provider credential/runtime failure stops before second job; no probe outside budget',async()=>{
 const t=transport();t.mode='provider-failure';const r=await run(config(),t);assert.equal(r.status,'stopped');assert.equal(r.stopReason,'PROVIDER_UNAVAILABLE');assert.equal(t.provider,1);assert.equal(t.claims,1);assert.equal(r.jobs.length,1);
});
test('database authentication failure cannot reach mutation or provider',async()=>{
 const t=transport();t.fetch=async()=>new Response('{}',{status:401});const r=await run(config(),t);assert.equal(r.stopReason,'PREFLIGHT_FAILED');assert.equal(r.reconciliationRequired,false);assert.equal(r.requestCount,0);
});
test('atomic claim resolves concurrent runners without duplicate provider batches',async()=>{
 const t=transport(),e=config(),results=await Promise.all([run(e,t),run(e,t)]);assert.equal(t.provider,40);assert.ok(results.some(r=>r.status==='attempts_finished'));assert.ok(results.some(r=>r.status!=='attempts_finished'));assert.ok(results.some(r=>r.reconciliationRequired||r.status==='blocked'));
});
test('expiry during preflight prevents any mutation',async()=>{
 const e=config(),t=transport();let time=Date.now(),fetch=t.fetch;t.fetch=async(...a)=>{const r=await fetch(...a);time=Date.parse(e.GLITCH_HOLDER_RECOVERY_EXPIRES_AT);return r;};const r=await run(e,t,{now:()=>time});assert.equal(r.status,'blocked');assert.equal(t.claims,0);assert.equal(t.provider,0);
});
test('workflow remains manual, exact-SHA checkout, default-disabled, shared concurrency, minimal artifact',()=>{
 const s=readFileSync(new URL('../../../.github/workflows/glitch-holder-worker-manual.yml',import.meta.url),'utf8');assert.match(s,/workflow_dispatch:/);assert.doesNotMatch(s,/schedule:|cron:|npm install|npm ci/);assert.match(s,/default: disabled/);assert.match(s,/inputs.mode == 'assessment'/);assert.match(s,/inputs.mode == 'recovery'/);assert.match(s,/github.run_attempt == 1/);assert.match(s,/github.sha == inputs.expected_sha/);assert.match(s,/group: glitch-holder-investigation/);assert.match(s,/ref: \$\{\{ github.sha \}\}/);assert.match(s,/persist-credentials: false/);assert.match(s,/retention-days: 3/);assert.match(s,/path: mvp\/wallet-signal\/artifacts\/holder-recovery-receipt.json/);
 const recovery=s.slice(s.indexOf('\n  recovery:'));assert.doesNotMatch(recovery,/WORKER_TOKEN|BYPASS|SCAN_INTERNAL_TOKEN/);assert.match(recovery,/secrets.SUPABASE_SERVICE_ROLE_KEY/);
});
test('runner dependency graph uses only local modules and Node builtins; no install needed',()=>{
 const visited=new Set();function visit(url){const path=fileURLToPath(url);if(visited.has(path))return;visited.add(path);const text=readFileSync(path,'utf8');for(const match of text.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)){const spec=match[1];if(spec.startsWith('node:'))continue;assert.ok(spec.startsWith('.'),spec);visit(new URL(spec,url));}}
 visit(new URL('../scripts/run-holder-actions-recovery.mjs',import.meta.url));assert.ok(visited.size>10);
});

test('wrong provider envelope stops before second job, without retries or leaking response',async()=>{
 const t=transport(),original=t.fetch;t.fetch=async(url,o)=>new URL(url).hostname==='mainnet.helius-rpc.com'?Response.json({jsonrpc:'2.0',id:'wrong',result:null,private:'secret'}):original(url,o);
 const r=await run(config(),t);assert.equal(r.status,'stopped');assert.equal(r.stopReason,'PROVIDER_UNAVAILABLE');assert.equal(r.requestCount,1);assert.equal(t.claims,1);assert.ok(!JSON.stringify(r).includes('secret'));
});
