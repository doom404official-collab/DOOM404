import test from 'node:test';
import assert from 'node:assert/strict';
import {Client} from 'pg';
import {generateKeyPairSync,sign} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {createCreatorSyntheticEndpoint} from '../lib/creatorEvidenceEndpoint.mjs';
import {runCreatorSyntheticAttempt,requestCreatorActionsOidc} from '../lib/creatorEvidenceSyntheticRunner.mjs';
import {validateCreatorSealedBinding,renderCreatorSealedTransition} from '../lib/creatorEvidenceSealedBinding.mjs';
import {TEST_OBJECT,TEST_HASH,TEST_REF,TEST_WORKFLOW,testBytes} from '../lib/creatorEvidenceTestProfile.mjs';
import {GITHUB_ISSUER,GITHUB_JWKS} from '../lib/creatorEvidenceOidc.mjs';
const now=1800000000,url='https://doom404-wallet-signal-synthetic-doom-404.vercel.app';
function binding(){const m={repository:'doom404official-collab/DOOM404',repository_id:'1405094598',repository_owner:'doom404official-collab',repository_owner_id:'335732040',ref:TEST_REF,sha:'a'.repeat(40),workflow_sha:'a'.repeat(40),workflow_ref:'doom404official-collab/DOOM404/.github/workflows/'+TEST_WORKFLOW+'@'+TEST_REF,run_id:'123456',run_attempt:'1',event_name:'workflow_dispatch',environment:'synthetic',runner_environment:'github-hosted',sub:'synthetic-only-subject',audience:url+'/api/creator-evidence-test/upload',startsAt:now-1,expiresAt:now+120};return {version:1,projectRef:'acwmtobcbpkjfqiatyke',vercelProjectId:'prj_AbsbiTw8Kc8axGpZ3FFpH9VvDS4e',deploymentId:'dpl_synthetic',deploymentUrl:url,commit:m.sha,approvalRef:'synthetic-fixture-not-approval',uploadUid:'11111111-1111-4111-8111-111111111111',readUid:'22222222-2222-4222-8222-222222222222',objectKey:TEST_OBJECT,payloadSha256:TEST_HASH,byteLength:75,upload:m,readback:{...m,run_id:'123457',audience:url+'/api/creator-evidence-test/verify'}};}
const temp=mkdtempSync(tmpdir()+'/creator-cert-');let ca;
try{execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',temp+'/key','-out',temp+'/cert','-days','1','-subj','/CN=synthetic'],{stdio:'ignore'});ca=readFileSync(temp+'/cert','utf8');}finally{rmSync(temp,{recursive:true});}
const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const storageToken=uid=>enc({alg:'RS256'})+'.'+enc({sub:uid,role:'authenticated',aud:'authenticated',iss:'https://acwmtobcbpkjfqiatyke.supabase.co/auth/v1',exp:now+600})+'.c3ludGhldGlj';
function config(){const b=binding();return {enabled:true,sealedBinding:b,deployment:{target:'preview',projectId:b.vercelProjectId,id:b.deploymentId,url,commit:b.commit,branch:TEST_REF.slice(11)},postgresConfigs:Object.fromEntries(['issuer','consumer','verifier'].map(p=>[p,{host:'db.acwmtobcbpkjfqiatyke.supabase.co',port:5432,database:'postgres',user:'creator_test_'+p+'_login',password:'synthetic-only',ca}])),storageSessions:{upload:storageToken(b.uploadUid),readback:storageToken(b.readUid)},publishableKey:'sb_publishable_synthetic'};}
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...publicKey.export({format:'jwk'}),kid:'synthetic',alg:'RS256',use:'sig'};
function token(m){const {startsAt,expiresAt,audience,...claims}=m;const d=enc({alg:'RS256',typ:'JWT',kid:'synthetic'})+'.'+enc({...claims,iss:GITHUB_ISSUER,aud:audience,iat:now,nbf:now,exp:now+120,jti:'synthetic-'+m.run_id});return d+'.'+sign('RSA-SHA256',Buffer.from(d),privateKey).toString('base64url');}
function environment(c){return {VERCEL_ENV:'preview',VERCEL_TARGET_ENV:'preview',VERCEL_GIT_COMMIT_REF:TEST_REF.slice(11),VERCEL_PROJECT_ID:c.deployment.projectId,VERCEL_DEPLOYMENT_ID:c.deployment.id,VERCEL_URL:url.slice(8),VERCEL_GIT_COMMIT_SHA:c.deployment.commit,CREATOR_TEST_DB_CA_PEM:ca,CREATOR_TEST_DB_ISSUER_PASSWORD:'synthetic',CREATOR_TEST_DB_CONSUMER_PASSWORD:'synthetic',CREATOR_TEST_DB_VERIFIER_PASSWORD:'synthetic'};}
function setup(t,{storageHook}={}){
 const c=config(),env=environment(c);let record,used=false,read=false,stored,time=now,puts=0,gets=0,queries=0;
 t.mock.method(Client.prototype,'connect',async()=>{});t.mock.method(Client.prototype,'end',async()=>{});
 t.mock.method(Client.prototype,'query',async function(q){queries++;const v=JSON.parse(q.values[0]);let result;
  if(q.text.includes('.relay_runtime_configuration(')){assert.equal(this.user,'creator_test_'+(v.action==='verify'?'verifier':'issuer')+'_login');const phase=v.action==='verify'?'readback':'upload';result={sealedBinding:c.sealedBinding,phase,storageSessions:{[phase]:c.storageSessions[phase]},publishableKey:c.publishableKey};}
  else if(q.text.includes('.relay_reserve(')){result=!record;if(result)record=v;}
  else if(q.text.includes('.relay_consume(')){result=used?null:record;used=true;}
  else if(q.text.includes('.relay_readback(')){result=read?null:record;read=true;}
  else assert.fail('unapproved query');return {rows:[{result}]};
 });
 const h=createCreatorSyntheticEndpoint({enabled:true},{readVariable:k=>env[k],now:()=>time*1000,fetchImpl:async(u,o)=>{
  if(u===GITHUB_JWKS)return Response.json({keys:[jwk]});
  assert.ok(u.endsWith('/'+TEST_OBJECT));
  if(o.method==='POST'){puts++;if(storageHook)return storageHook(o);assert.equal(stored,undefined);stored=Buffer.from(o.body);return Response.json({});}
  gets++;return new Response(stored);
 }});
 const invoke=(action,overrides={})=>{const m=action==='upload'?c.sealedBinding.upload:c.sealedBinding.readback;return runCreatorSyntheticAttempt({enabled:true,action,manifest:m,identity:m,...overrides},{now:()=>time*1000,getOidcToken:async()=>token(m),fetchImpl:async(u,o)=>h(new Request(u,o))});};
 return {c,env,h,invoke,setTime:t=>{time=t;},counts:()=>({puts,gets,queries})};
}
test('endpoint and runner default disabled with zero dependency/credential reads',async()=>{
 const deps=new Proxy({},{get(){assert.fail('read');}});assert.equal((await createCreatorSyntheticEndpoint({},deps)(null)).status,404);assert.equal((await runCreatorSyntheticAttempt({},deps)).status,'DISABLED');
});
test('actual endpoint-loader-runner composition verifies signed separate runs and fixed bytes',async t=>{
 const s=setup(t);assert.equal((await s.invoke('upload')).status,'UPLOAD_REPORTED');assert.equal((await s.invoke('readback')).status,'READBACK_VERIFIED');assert.equal(s.counts().puts,1);assert.equal(s.counts().gets,1);
 assert.equal((await s.invoke('upload')).status,'RECONCILIATION_REQUIRED');assert.equal(s.counts().puts,1);
});
test('concurrent duplicate upload attempts yield one permanent claim and one put',async t=>{
 const s=setup(t),r=await Promise.all([s.invoke('upload'),s.invoke('upload')]);assert.equal(r.filter(v=>v.status==='UPLOAD_REPORTED').length,1);assert.equal(s.counts().puts,1);
});
for(const field of ['VERCEL_ENV','VERCEL_GIT_COMMIT_REF','VERCEL_PROJECT_ID','VERCEL_DEPLOYMENT_ID','VERCEL_GIT_COMMIT_SHA'])test('wrong endpoint scope '+field,async t=>{
 const s=setup(t);s.env[field]='wrong';assert.notEqual((await s.invoke('upload')).status,'UPLOAD_REPORTED');assert.equal(s.counts().puts,0);
});
for(const field of ['run_id','run_attempt','ref','sha','workflow_ref'])test('runner identity mismatch '+field+' before network',async()=>{
 const m=binding().upload;const r=await runCreatorSyntheticAttempt({enabled:true,action:'upload',manifest:m,identity:{...m,[field]:'wrong'}},{now:()=>now*1000,getOidcToken:()=>assert.fail('OIDC'),fetchImpl:()=>assert.fail('fetch')});assert.equal(r.status,'NOT_DISPATCHED');
});
test('expired and cancelled attempts send nothing',async t=>{
 const s=setup(t);s.setTime(now+120);assert.equal((await s.invoke('upload')).status,'NOT_DISPATCHED');s.setTime(now);const a=new AbortController();a.abort();assert.equal((await s.invoke('upload',{signal:a.signal})).status,'NOT_DISPATCHED');assert.equal(s.counts().queries,0);
});
test('upload cancellation retains uncertainty even when storage completes late',async t=>{
 const a=new AbortController();let late;
 const s=setup(t,{storageHook:()=>{a.abort();return new Promise(r=>{late=r;});}});
 const r=await s.invoke('upload',{signal:a.signal});assert.equal(r.status,'RECONCILIATION_REQUIRED');assert.equal(r.retries,0);assert.equal(s.counts().puts,1);late(Response.json({}));await new Promise(r=>setImmediate(r));assert.equal(s.counts().puts,1);
});
test('malformed/lost response is never retried or leaked',async()=>{
 const m=binding().upload;let calls=0;const r=await runCreatorSyntheticAttempt({enabled:true,action:'upload',manifest:m,identity:m},{now:()=>now*1000,getOidcToken:async()=>token(m),fetchImpl:async()=>{calls++;return new Response('secret-invalid-json');}});assert.equal(r.status,'RECONCILIATION_REQUIRED');assert.equal(calls,1);assert.ok(!JSON.stringify(r).includes('secret'));
});
test('expiry after issue forbids upload and retains reservation uncertainty',async()=>{
 const m=binding().upload;let time=now,calls=0;const r=await runCreatorSyntheticAttempt({enabled:true,action:'upload',manifest:m,identity:m},{now:()=>time*1000,getOidcToken:async()=>token(m),fetchImpl:async()=>{calls++;time=now+120;return Response.json({capability:'a'.repeat(43),expiresAt:now+120,objectKey:TEST_OBJECT,eligibleForLivePromotion:false});}});assert.equal(r.status,'RECONCILIATION_REQUIRED');assert.equal(calls,1);
});
test('OIDC transport restricts destination and never retries',async()=>{
 let calls=0;await assert.rejects(()=>requestCreatorActionsOidc({requestUrl:'https://evil.invalid/token',requestToken:'private',audience:url,fetchImpl:async()=>{calls++;}}));assert.equal(calls,0);
 const m=binding().upload;const v=await requestCreatorActionsOidc({requestUrl:'https://pipelines.actions.githubusercontent.com/test?api-version=2',requestToken:'synthetic-bearer',audience:m.audience,fetchImpl:async(u,o)=>{calls++;assert.equal(new URL(u).searchParams.get('audience'),m.audience);assert.equal(o.redirect,'error');return Response.json({value:token(m)});}});assert.equal(v,token(m));assert.equal(calls,1);
});
test('response-body stall cancellation returns promptly without retry',async()=>{
 const m=binding().upload,a=new AbortController();let calls=0;
 const r=await runCreatorSyntheticAttempt({enabled:true,action:'upload',manifest:m,identity:m,signal:a.signal},{now:()=>now*1000,getOidcToken:async()=>token(m),fetchImpl:async()=>{calls++;setTimeout(()=>a.abort(),1);return new Response(new ReadableStream({start(){}}));}});
 assert.equal(r.status,'RECONCILIATION_REQUIRED');assert.equal(calls,1);
});
test('noncooperative OIDC cancellation is pre-dispatch and does not retry',async()=>{
 const m=binding().upload,a=new AbortController();setTimeout(()=>a.abort(),1);
 const r=await runCreatorSyntheticAttempt({enabled:true,action:'upload',manifest:m,identity:m,signal:a.signal},{now:()=>now*1000,getOidcToken:()=>new Promise(()=>{}),fetchImpl:()=>assert.fail('POST forbidden')});assert.equal(r.status,'NOT_DISPATCHED');
});
test('wrong Storage role and stale envelope never create claims or Storage writes',async t=>{
 const s=setup(t);s.c.storageSessions.upload=enc({alg:'RS256'})+'.'+enc({sub:s.c.sealedBinding.uploadUid,role:'service_role',aud:'authenticated',iss:'https://acwmtobcbpkjfqiatyke.supabase.co/auth/v1',exp:now+600})+'.c2ln';
 assert.equal((await s.invoke('upload')).status,'RECONCILIATION_REQUIRED');assert.equal(s.counts().puts,0);assert.equal(s.counts().queries,1);
});
test('malformed bearer/body is rejected before configuration or body reads',async()=>{
 const h=createCreatorSyntheticEndpoint({enabled:true},{readVariable:()=>assert.fail('no secret')});
 assert.equal((await h(new Request(url+'/api/creator-evidence-test/issue',{method:'POST',headers:{authorization:'Bearer malformed'},body:'{}'}))).status,404);
});
