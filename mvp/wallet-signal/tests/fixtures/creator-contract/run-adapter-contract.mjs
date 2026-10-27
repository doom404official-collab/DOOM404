// Explicit disposable-only bridge: invokes PostgreSQL through docker exec, never HTTP.
import assert from 'node:assert/strict';
import {mkdirSync,rmdirSync} from 'node:fs';
const lock='/tmp/glitch-creator-contract-test.lock';mkdirSync(lock,{mode:0o700});
process.on('exit',()=>rmdirSync(lock));
import {spawn,execFileSync} from 'node:child_process';
import {createCreatorIntelligenceJobStoreV2} from '../../../lib/creatorIntelligenceJobStoreV2.mjs';
const container='creator-contract-disposable',db='glitch_creator_contract_test';
const info=JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8'}))[0];
assert.equal(info.HostConfig.NetworkMode,'none');assert.equal(info.Config.Image,'postgres:17');assert.ok(info.Mounts.every(m=>m.Type==='tmpfs'));
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
function sql(query){return new Promise((resolve,reject)=>{
 const p=spawn('docker',['exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','creator_test','-d',db],{stdio:['pipe','pipe','pipe']});let out='',error='';
 p.stdout.on('data',v=>out+=v);p.stderr.on('data',v=>error+=v);p.on('error',reject);p.on('close',code=>code?reject(Error(error)):resolve(out.trim()));p.stdin.end(query);
});}
assert.equal(await sql('SELECT current_database()'),db);
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
const original={retained:['synthetic-before'],raw:'900719925474099312345'};
async function reset(revision='0'){await sql(`TRUNCATE creator_intelligence_jobs; INSERT INTO creator_intelligence_jobs(mint,status,stage,state,request_count_total,revision) VALUES(${quote(mint)},'partial','selling',${quote(JSON.stringify(original))}::jsonb,7189,${revision});`);}
let transportCount=0;
async function bridge(url,options){
 transportCount++;assert.equal(new URL(url).origin,'https://test.supabase.co');options.signal.throwIfAborted();let query;
 if(options.method==='GET'){
  assert.equal(new URL(url).searchParams.get('mint'),'eq.'+mint);assert.ok(new URL(url).searchParams.get('select').includes('revision::text'));
  query=`SELECT coalesce(jsonb_agg(t),'[]'::jsonb)::text FROM (SELECT mint,status,stage,state,request_count_total::text,lease_owner,lease_until,created_at,updated_at,revision::text FROM creator_intelligence_jobs WHERE mint=${quote(mint)}) t;`;
 }else{
  assert.equal(options.method,'POST');const path=new URL(url).pathname;const body=JSON.parse(options.body);assert.equal(typeof body.p_expected_revision,'string');
  const payload=quote(JSON.stringify(body))+'::jsonb';
  if(path==='/rest/v1/rpc/claim_creator_intelligence_job_v2')query=`SELECT coalesce(claim_creator_intelligence_job_v2(p_mint,p_owner,p_expected_revision,p_lease_seconds),'null'::jsonb)::text FROM jsonb_to_record(${payload}) AS p(p_mint text,p_owner text,p_expected_revision bigint,p_lease_seconds integer);`;
  else{assert.equal(path,'/rest/v1/rpc/save_creator_intelligence_progress_v2');query=`SELECT coalesce(save_creator_intelligence_progress_v2(p_mint,p_owner,p_expected_revision,p_stage,p_status,p_state,p_request_delta),'null'::jsonb)::text FROM jsonb_to_record(${payload}) AS p(p_mint text,p_owner text,p_expected_revision bigint,p_stage text,p_status text,p_state jsonb,p_request_delta integer);`;}
 }
 const result=await sql(query);return {ok:true,json:async()=>JSON.parse(result)};
}
const create=()=>createCreatorIntelligenceJobStoreV2({enabled:true,url:'https://test.supabase.co',key:'disposable-only',fetchImpl:bridge});
const save=(store,proof,state,status='partial')=>store.save({mint,owner:proof.owner,expectedRevision:proof.revision,leaseUntil:proof.leaseUntil,stage:'selling',status,state,requestCount:1});
await reset();let store=create(),row=await store.read(mint),claimed=await store.claim({mint,owner:'synthetic-owner-a',expectedRevision:row.revision});
assert.deepEqual(claimed.job.state,original);let proof=await save(store,claimed.receipt,{...original,next:'one'},'running');
assert.equal(proof.revision,'2');assert.equal(proof.leaseUntil,claimed.receipt.leaseUntil);
proof=await save(store,proof,{...original,next:'two'});assert.equal(proof.revision,'3');assert.equal(proof.owner,null);
row=await store.read(mint);assert.equal(row.request_count_total,'7191');assert.deepEqual(row.state,{...original,next:'two'});console.log('PASS adapter/SQL read-claim-reread-running-final contract');
await reset('9007199254740992');store=create();row=await store.read(mint);assert.equal(row.revision,'9007199254740992');claimed=await store.claim({mint,owner:'synthetic-owner-a',expectedRevision:row.revision});assert.equal(claimed.receipt.revision,'9007199254740993');console.log('PASS SQL text projection and receipt preserve large revisions');
await reset();const a=create(),b=create();await Promise.all([a.read(mint),b.read(mint)]);
const results=await Promise.allSettled([a.claim({mint,owner:'synthetic-owner-a',expectedRevision:'0'}),b.claim({mint,owner:'synthetic-owner-b',expectedRevision:'0'})]);
assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.find(x=>x.status==='rejected').reason.message,'CREATOR_V2_CONFLICT');assert.equal(await sql('SELECT revision FROM creator_intelligence_jobs'),'1');console.log('PASS independent adapters and SQL permit one claim');
await reset();store=create();row=await store.read(mint);claimed=await store.claim({mint,owner:'synthetic-owner-a',expectedRevision:row.revision});
await sql("UPDATE creator_intelligence_jobs SET revision=revision+1,state='{\"otherWriter\":true}'::jsonb;");
await assert.rejects(save(store,claimed.receipt,original),{message:'CREATOR_V2_CONFLICT'});assert.equal(await sql("SELECT state->>'otherWriter' FROM creator_intelligence_jobs"),'true');let before=transportCount;await assert.rejects(save(store,claimed.receipt,original),{message:'CREATOR_V2_RECONCILIATION_REQUIRED'});assert.equal(transportCount,before);console.log('PASS stale adapter cannot overwrite or retry after SQL conflict');
await reset();store=create();row=await store.read(mint);claimed=await store.claim({mint,owner:'synthetic-owner-a',expectedRevision:row.revision});await sql("UPDATE creator_intelligence_jobs SET lease_until=clock_timestamp()-interval '1 second'");await assert.rejects(save(store,claimed.receipt,original),{message:'CREATOR_V2_CONFLICT'});assert.equal(await sql('SELECT request_count_total FROM creator_intelligence_jobs'),'7189');console.log('PASS server expiry rejects save despite previously valid client receipt');
console.log(JSON.stringify({passed:5,hostedAccess:false,httpRequests:0,syntheticSqlBridge:true}));
