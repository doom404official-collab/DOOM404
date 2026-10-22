import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {timingSafeEqual} from 'node:crypto';

// Execute the actual route with imports replaced by isolated offline dependencies.
const source=readFileSync(new URL('../app/api/holder-scan-tick/route.js',import.meta.url),'utf8')
 .replace(/^import .*;\n/gm,'').replace(/export /g,'');
function route({candidate={id:'job-a',holder_set_hash:'hash-a'},result={status:'partial',requestCount:20},env={},fail,worker}={}){
 const calls=[];
 const context=vm.createContext({Buffer,timingSafeEqual,AbortSignal,Date,
  process:{env:{GLITCH_HOLDER_WORKER_ENABLED:'true',GLITCH_HOLDER_WORKER_TOKEN:'synthetic-token',HELIUS_RPC_URL:'https://offline.invalid',...env}},
  NextResponse:{json:(body,options={})=>({body,options})},
  fetch:()=>{throw Error('NETWORK_FORBIDDEN');},
  createHolderJobStore:()=>{calls.push('store');if(fail==='store')throw Error('private state');return {
   getNextRunnable:async()=>{calls.push('select');if(fail==='select')throw Error('private state');return typeof candidate==='function'?candidate():candidate;}
  };},
  processHolderScanJob:async(args)=>{calls.push({jobId:args.jobId,maxRequests:args.maxRequests,leaseSeconds:args.leaseSeconds});
   if(fail==='worker')throw Error('private credential or history');
   return worker?worker(args):result;}
 });
 vm.runInContext(source,context);
 return {calls,post:(token='synthetic-token')=>context.POST({headers:{get:()=>token}})};
}
const plain=value=>JSON.parse(JSON.stringify(value));
test('alternating jobs on one mint retain selected job and holder-set identity',async()=>{
 const rows=[{id:'job-a',mint:'same-mint',holder_set_hash:'hash-a',checkpoint:{private:'secret'}},
  {id:'job-b',mint:'same-mint',holder_set_hash:'hash-b',lease_owner:'private'},
  {id:'job-a',mint:'same-mint',holder_set_hash:'hash-a'}];
 const r=route({candidate:()=>rows.shift(),result:{status:'partial',requestCount:20,view:{private:'history'},version:99}});
 for(const id of ['a','b','a']){
  const response=await r.post();
  assert.deepEqual(plain(response.body),{status:'partial',requestCount:20,jobId:'job-'+id,holderSetHash:'hash-'+id});
  assert.equal(response.options.headers['Cache-Control'],'no-store');
 }
 assert.deepEqual(r.calls,['store','select',{jobId:'job-a',maxRequests:20,leaseSeconds:90},'store','select',
  {jobId:'job-b',maxRequests:20,leaseSeconds:90},'store','select',{jobId:'job-a',maxRequests:20,leaseSeconds:90}]);
});
test('idle has no identity and performs no worker or RPC work',async()=>{
 const r=route({candidate:null,env:{HELIUS_RPC_URL:undefined}});
 assert.deepEqual(plain((await r.post()).body),{status:'idle'});
 assert.deepEqual(r.calls,['store','select']);
});
test('legacy missing holder-set hash remains unknown',async()=>{
 const r=route({candidate:{id:'legacy'}});
 assert.equal((await r.post()).body.holderSetHash,null);
});
test('claim/lease/version failures describe only the selected attempt',async()=>{
 for(const status of ['ALREADY_CLAIMED','LEASE_LOST','VERSION_CONFLICT','failed']){
  const r=route({result:{status}});
  assert.deepEqual(plain((await r.post()).body),{status,requestCount:0,jobId:'job-a',holderSetHash:'hash-a'});
 }
});
test('disabled and unauthorized paths never select or reveal identity',async()=>{
 for(const [env,token,status] of [[{GLITCH_HOLDER_WORKER_ENABLED:'false'},'synthetic-token',503],[{},'wrong',401],[{},null,401]]){
  const r=route({env});const response=await r.post(token);
  assert.equal(response.options.status,status);assert.deepEqual(Object.keys(response.body),['error']);assert.deepEqual(r.calls,[]);
 }
});
test('store, selection, RPC configuration and worker errors remain sanitized',async()=>{
 for(const options of [{fail:'store'},{fail:'select'},{fail:'worker'},{env:{HELIUS_RPC_URL:'http://invalid'}}]){
  const response=await route(options).post();
  assert.equal(response.options.status,503);
  assert.deepEqual(plain(response.body),{error:'Scheduler tick unavailable'});
 }
});
test('RPC exceptions fail closed without returning selected identity or internal errors',async()=>{
 const response=await route({worker:async({rpc})=>rpc('getSignaturesForAddress',[])}).post();
 assert.equal(response.options.status,503);
 assert.deepEqual(plain(response.body),{error:'Scheduler tick unavailable'});
});
