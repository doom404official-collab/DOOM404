// Actual compiled route + actual pinned adapter; every external request is mocked.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHolderHistoryCheckpoint} from '../lib/holderHistoryCheckpoint.mjs';
const require=createRequire(import.meta.url),{POST}=require('../.next/server/app/api/holder-scan-recovery/route.js').routeModule.userland;
const ids=['c670f393-31b0-470c-a01f-cb2b813a1219','d07c0256-b472-4089-a237-99ed5e5c8cc4'],mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const start=Date.now(),realNow=Date.now;let time=start;Date.now=()=>time;
const baseConfig={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'fix/glitch-recovery-preflight-20261027',GLITCH_HOLDER_RECOVERY_ENABLED:'true',GLITCH_HOLDER_WORKER_ENABLED:'false',GLITCH_HOLDER_WORKER_TOKEN:'offline',SUPABASE_URL:'https://store.invalid',SUPABASE_SERVICE_ROLE_KEY:'offline',HELIUS_RPC_URL:'https://provider.invalid',GLITCH_HOLDER_RECOVERY_START_AT:new Date(start-1000).toISOString(),GLITCH_HOLDER_RECOVERY_EXPIRES_AT:new Date(start+600000).toISOString(),GLITCH_HOLDER_RECOVERY_JOB_C670_VERSION:'7',GLITCH_HOLDER_RECOVERY_JOB_D07_VERSION:'11'};
Object.assign(process.env,baseConfig);
const initial=id=>({id,mint,version:id===ids[0]?7:11,status:'partial',lease_owner:null,lease_expires_at:null,summary:{score:9.93},checkpoint:createHolderHistoryCheckpoint({mint,holders:Array.from({length:20},(_,i)=>({ownerWallet:'wallet'+i,tokenAccount:'account'+i,sharePct:1}))})});
let rows=new Map(ids.map(id=>[id,initial(id)])),calls=[],provider=0,claimed=0,cases=0;
global.fetch=async(url,o)=>{
 const u=new URL(url);calls.push(u.pathname);
 if(u.origin==='https://provider.invalid'){provider++;return new Response('{}',{status:503});}
 assert.equal(u.origin,'https://store.invalid');let value;
 if(o.method==='GET'){const id=u.searchParams.get('id').slice(3);value=[structuredClone(rows.get(id))];}
 else{
  const b=JSON.parse(o.body),r=rows.get(b.p_job_id);assert.ok(r);
  if(u.pathname.endsWith('/glitch_claim_holder_scan')){if(r.lease_owner)value=null;else{claimed++;Object.assign(r,{version:r.version+1,status:'running',lease_owner:b.p_worker,lease_expires_at:new Date(time+90000).toISOString()});value=r;}}
  else if(u.pathname.endsWith('/glitch_renew_holder_scan')){assert.equal(r.version,b.p_expected_version);assert.equal(r.lease_owner,b.p_worker);r.version++;value=r;}
  else if(u.pathname.endsWith('/glitch_commit_holder_scan')){assert.equal(r.version,b.p_expected_version);Object.assign(r,{version:r.version+1,checkpoint:b.p_checkpoint,summary:b.p_summary,status:b.p_status,lease_owner:null,lease_expires_at:null});value=r;}
  else assert.fail('Unexpected store operation');
 }
 return Response.json(value);
};
const request=(id=ids[0],version=id===ids[0]?7:11)=>new Request('https://offline.invalid/api/holder-scan-recovery',{method:'POST',headers:{'x-glitch-worker-token':'offline'},body:JSON.stringify({jobId:id,mint,expectedVersion:version})});
try{
 for(const [key,value] of [['GLITCH_HOLDER_RECOVERY_START_AT','bad'],['GLITCH_HOLDER_RECOVERY_EXPIRES_AT',new Date(start+1200001).toISOString()],['GLITCH_HOLDER_RECOVERY_JOB_C670_VERSION','7.5'],['GLITCH_HOLDER_RECOVERY_JOB_D07_VERSION',''],['GLITCH_HOLDER_RECOVERY_EXPIRES_AT',new Date(start-1).toISOString()],['GLITCH_HOLDER_RECOVERY_START_AT',new Date(start+1).toISOString()]]){
  process.env[key]=value;calls=[];const r=await POST(request());assert.equal(r.status,503);assert.equal((await r.json()).error,'Recovery disabled');assert.deepEqual(calls,[]);process.env[key]=baseConfig[key];cases++;
 }
 calls=[];assert.equal((await POST(request(ids[0],8))).status,409);assert.deepEqual(calls,[]);cases++;
 for(const id of ids){const before=provider,r=await POST(request(id));assert.equal(r.status,200);const body=await r.json();assert.equal(body.status,'partial');assert.equal(body.requestCount,1);assert.equal(provider,before+1);assert.equal(rows.get(id).summary.score,9.93);
  const again=await POST(request(id));assert.equal(again.status,503);assert.equal(provider,before+1);assert.equal((await POST(request(id,rows.get(id).version))).status,409);assert.equal(provider,before+1);cases++;
 }
 rows=new Map(ids.map(id=>[id,initial(id)]));const before=provider,claims=claimed;
 const responses=await Promise.all([POST(request()),POST(request())]);assert.equal(provider,before+1);assert.equal(claimed,claims+1);assert.ok(responses.some(r=>r.status===200));cases++;
 // Old deployment config is unchanged; expiry alone stops all downstream activity.
 time=Date.parse(baseConfig.GLITCH_HOLDER_RECOVERY_EXPIRES_AT);calls=[];const closed=await POST(request());assert.equal(closed.status,503);assert.equal((await closed.json()).error,'Recovery disabled');assert.deepEqual(calls,[]);cases++;
 console.log(JSON.stringify({passed:true,cases,providerCalls:provider,successfulClaims:claimed,mode:'compiled-window-replay-concurrency-mock-only'}));
}finally{Date.now=realNow;}
