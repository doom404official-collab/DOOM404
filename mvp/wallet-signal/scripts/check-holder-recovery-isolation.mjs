// Compiled route gate verification. All store traffic mocked; no provider calls.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHolderHistoryCheckpoint} from '../lib/holderHistoryCheckpoint.mjs';
const require=createRequire(import.meta.url),routes={};
for(const name of ['recovery','worker','tick','scheduler'])routes[name]=require('../.next/server/app/api/holder-scan-'+name+'/route.js').routeModule.userland.POST;
const ids=['c670f393-31b0-470c-a01f-cb2b813a1219','d07c0256-b472-4089-a237-99ed5e5c8cc4'];
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
Object.assign(process.env,{VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'fix/glitch-recovery-preflight-20261027',GLITCH_HOLDER_RECOVERY_ENABLED:'true',GLITCH_HOLDER_WORKER_TOKEN:'offline-only',SUPABASE_URL:'https://store.invalid',SUPABASE_SERVICE_ROLE_KEY:'offline-only',HELIUS_RPC_URL:'https://provider.invalid'});
let activeId=ids[0],calls=[],cases=0;
global.fetch=async(url,options)=>{
 const u=new URL(url);assert.equal(u.origin,'https://store.invalid','provider/network prohibited');calls.push(u.pathname);
 if(u.pathname==='/rest/v1/glitch_holder_scan_jobs'){
  assert.equal(options.method,'GET');assert.equal(u.searchParams.get('id'),'eq.'+activeId);
  const checkpoint=createHolderHistoryCheckpoint({mint,holders:Array.from({length:20},(_,i)=>({ownerWallet:'wallet'+i,tokenAccount:'account'+i,sharePct:1}))});
  return Response.json([{id:activeId,mint,version:7,status:'partial',lease_owner:null,lease_expires_at:null,checkpoint,summary:{}}]);
 }
 assert.equal(u.pathname,'/rest/v1/rpc/glitch_claim_holder_scan');assert.equal(JSON.parse(options.body).p_job_id,activeId);return Response.json(null);
};
const request=(token='offline-only',body={jobId:activeId,mint,expectedVersion:7})=>new Request('https://local.invalid/api/test',{method:'POST',headers:{'x-glitch-worker-token':token},body:JSON.stringify(body)});
for(const ordinaryFlag of [undefined,'false']){
 if(ordinaryFlag===undefined)delete process.env.GLITCH_HOLDER_WORKER_ENABLED;else process.env.GLITCH_HOLDER_WORKER_ENABLED=ordinaryFlag;
 for(const name of ['worker','tick','scheduler']){calls=[];const r=await routes[name](request());assert.equal(r.status,503);assert.deepEqual(calls,[]);cases++;}
 for(const id of ids){activeId=id;calls=[];const r=await routes.recovery(request());assert.equal(r.status,200);assert.equal((await r.json()).status,'ALREADY_CLAIMED');assert.deepEqual(calls,['/rest/v1/glitch_holder_scan_jobs','/rest/v1/rpc/glitch_claim_holder_scan']);cases++;}
}
for(const [key,value] of [['VERCEL_ENV','production'],['VERCEL_GIT_COMMIT_REF','main'],['GLITCH_HOLDER_RECOVERY_ENABLED','false'],['GLITCH_HOLDER_RECOVERY_ENABLED',undefined]]){
 const saved=process.env[key];if(value===undefined)delete process.env[key];else process.env[key]=value;
 process.env.GLITCH_HOLDER_WORKER_ENABLED='true';calls=[];assert.equal((await routes.recovery(request())).status,503);assert.deepEqual(calls,[]);process.env[key]=saved;cases++;
}
for(const token of ['wrong','']){calls=[];assert.equal((await routes.recovery(request(token))).status,401);assert.deepEqual(calls,[]);cases++;}
calls=[];assert.equal((await routes.recovery(request('offline-only',{jobId:'other',mint,expectedVersion:7}))).status,400);assert.deepEqual(calls,[]);cases++;
console.log(JSON.stringify({passed:true,cases,providerCalls:0,mode:'compiled-recovery-only-gates-mocked-store'}));
