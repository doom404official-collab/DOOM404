// Compiled ordinary routes. Strict fake transports; never contacts a provider/store.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHolderHistoryCheckpoint} from '../lib/holderHistoryCheckpoint.mjs';
const require=createRequire(import.meta.url);
Object.assign(process.env,{GLITCH_HOLDER_WORKER_ENABLED:'true',GLITCH_HOLDER_WORKER_TOKEN:'offline',SUPABASE_URL:'https://store.invalid',SUPABASE_SERVICE_ROLE_KEY:'offline',HELIUS_RPC_URL:'https://provider.invalid'});
let cases=0;
for(const routeName of ['holder-scan-worker','holder-scan-tick','holder-scan-scheduler']){
 const {POST}=require('../.next/server/app/api/'+routeName+'/route.js').routeModule.userland;
 for(const mode of ['unauthorized','disabled','success','lost-renewal','uncertain-commit']){
  if(routeName==='holder-scan-scheduler'&&['lost-renewal','uncertain-commit'].includes(mode))continue;
  let row={id:'11111111-1111-1111-1111-111111111111',mint:'mint',version:1,status:'partial',lease_owner:null,lease_expires_at:null,summary:{score:9.93},checkpoint:createHolderHistoryCheckpoint({mint:'mint',holders:Array.from({length:20},(_,i)=>({ownerWallet:'w'+i,tokenAccount:'a'+i,sharePct:1}))})};
  let calls=0,provider=0,commits=0;
  global.fetch=async(url,o)=>{
   calls++;const u=new URL(url);assert.ok(o.signal instanceof AbortSignal);let result;
   if(u.origin==='https://provider.invalid'){provider++;assert.equal(JSON.parse(o.body).method,'getSignaturesForAddress');result={result:[]};}
   else{
    assert.equal(u.origin,'https://store.invalid');const b=o.body?JSON.parse(o.body):{};
    if(u.pathname==='/rest/v1/glitch_holder_scan_jobs'){assert.equal(o.method,'GET');assert.equal(u.searchParams.get('order'),'updated_at.asc');result=[{id:row.id}];}
    else if(u.pathname.endsWith('/glitch_claim_holder_scan')){assert.equal(b.p_job_id,row.id);row={...row,status:'running',version:row.version+1,lease_owner:b.p_worker,lease_expires_at:new Date(Date.now()+90000).toISOString()};result=row;}
    else if(u.pathname.endsWith('/glitch_renew_holder_scan')){assert.equal(b.p_expected_version,row.version);row={...row,version:row.version+1};result=mode==='lost-renewal'?null:row;}
    else if(u.pathname.endsWith('/glitch_commit_holder_scan')){commits++;assert.equal(b.p_expected_version,row.version);row={...row,version:row.version+1,checkpoint:b.p_checkpoint,summary:b.p_summary,status:b.p_status,lease_owner:null,lease_expires_at:null};if(mode==='uncertain-commit')throw Error('SECRET_ENDPOINT_TOKEN');result=row;}
    else assert.fail('Unexpected request');
   }
   return new Response(JSON.stringify(result),{headers:{'Content-Type':'application/json'}});
  };
  process.env.GLITCH_HOLDER_WORKER_ENABLED=mode==='disabled'?'false':'true';
  const r=await POST(new Request('https://test.invalid/api/'+routeName,{method:'POST',headers:{'x-glitch-worker-token':mode==='unauthorized'?'wrong':'offline'},body:JSON.stringify({jobId:row.id})}));const body=await r.json();
  assert.ok(!JSON.stringify(body).includes('SECRET'));
  if(mode==='unauthorized'||mode==='disabled'){assert.equal(calls,0);assert.equal(r.status,mode==='unauthorized'?401:503);}
  else if(mode==='success'){assert.equal(r.status,200);assert.equal(body.jobId,row.id);assert.equal(body.status,routeName==='holder-scan-scheduler'?'candidate':'complete');assert.ok(provider<=(routeName==='holder-scan-worker'?25:20));assert.equal(row.summary.score,9.93);}
  else{assert.equal(r.status,503);assert.equal(body.retryAllowed,false);assert.equal(body.reconciliationRequired,true);assert.equal(body.status,mode==='lost-renewal'?'LEASE_LOST':'COMMIT_OUTCOME_UNKNOWN');assert.equal(commits,mode==='lost-renewal'?0:1);}
  cases++;
 }
}
console.log(JSON.stringify({passed:true,cases,mode:'compiled-ordinary-routes-mock-only'}));
