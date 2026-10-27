import {createHolderRecoveryBudget} from '../lib/holderRecoveryBudget.mjs';
import {setTimeout as delay} from 'node:timers/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../app/api/holder-scan-recovery/route.js',import.meta.url),'utf8');
const keys=['VERCEL_ENV','VERCEL_GIT_COMMIT_REF','GLITCH_HOLDER_RECOVERY_ENABLED','GLITCH_HOLDER_WORKER_ENABLED','GLITCH_HOLDER_WORKER_TOKEN','HELIUS_RPC_URL'];
const configured=['preview','fix/glitch-recovery-preflight-20261027','true','false','fixture-token','https://offline.invalid'];
function load(run,create=()=>({}),wait=delay){return new Function('createHolderRecoveryBudget','delay','NextResponse','timingSafeEqual','createHolderJobStore','runPinnedHolderRecovery',source.replace(/^import .*;\n/gm,'').replace(/export const /g,'const ').replace('export async function POST','async function POST')+'\nreturn POST;' )(createHolderRecoveryBudget,wait,{json:(body,options={})=>({body,...options})},(a,b)=>a.equals(b),create,run);}
const payload={jobId:'c670f393-31b0-470c-a01f-cb2b813a1219',mint:'98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump',expectedVersion:2134};
const request=(body=payload,token='fixture-token')=>({headers:{get:()=>token},json:async()=>body});
test('route enforces environment, opt-in, authentication and pinned inputs before store creation',async()=>{
 const saved=keys.map(k=>process.env[k]);let calls=0;
 try{
  keys.forEach((k,i)=>process.env[k]=configured[i]);
  const post=load(async a=>{calls++;assert.equal(a.jobId,payload.jobId);assert.equal(a.expectedVersion,2134);assert.equal(a.maxRequests,20);assert.equal(a.leaseSeconds,90);return {status:'partial'};},()=>{calls++;return {};});
  for(const [key,bad] of [['VERCEL_ENV','production'],['VERCEL_GIT_COMMIT_REF','main'],['GLITCH_HOLDER_RECOVERY_ENABLED','false']]){
   const old=process.env[key];process.env[key]=bad;assert.equal((await post(request())).status,503);process.env[key]=old;
  }
  assert.equal((await post(request(payload,'wrong'))).status,401);
  for(const bad of [{...payload,jobId:'other'},{...payload,mint:'other'},{...payload,expectedVersion:undefined},{...payload,expectedVersion:'2134'}])assert.equal((await post(request(bad))).status,400);
  assert.equal(calls,0);assert.equal((await post(request())).body.status,'partial');assert.equal(calls,2);
 }finally{keys.forEach((k,i)=>saved[i]===undefined?delete process.env[k]:process.env[k]=saved[i]);}
});

test('route pacing cancellation cannot start another provider request',async()=>{
 const saved=keys.map(k=>process.env[k]),originalFetch=global.fetch;let calls=0;const controller=new AbortController();
 try{
  keys.forEach((k,i)=>process.env[k]=configured[i]);
  global.fetch=async()=>{calls++;return {ok:true,json:async()=>({result:[]})};};
  const post=load(async({rpc})=>{
   await rpc('getTransaction',[],{signal:controller.signal});
   await assert.rejects(rpc('getTransaction',[],{signal:controller.signal}),/cancelled/);
   return {status:'COMMIT_OUTCOME_UNKNOWN',reconciliationRequired:true,retryAllowed:false};
  },()=>({}),async()=>{controller.abort(Error('cancelled'));throw controller.signal.reason;});
  const r=await post(request());assert.equal(calls,1);assert.equal(r.status,503);assert.equal(r.body.retryAllowed,false);
 }finally{global.fetch=originalFetch;keys.forEach((k,i)=>saved[i]===undefined?delete process.env[k]:process.env[k]=saved[i]);}
});
