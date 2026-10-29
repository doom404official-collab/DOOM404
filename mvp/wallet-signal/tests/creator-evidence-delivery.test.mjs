import {response as authResponse,U,R} from './fixtures/creator-evidence/owner-auth-fixture.mjs';
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
function binding(){const m={repository:'doom404official-collab/DOOM404',repository_id:'1405094598',repository_owner:'doom404official-collab',repository_owner_id:'335732040',ref:TEST_REF,sha:'a'.repeat(40),workflow_sha:'a'.repeat(40),workflow_ref:'doom404official-collab/DOOM404/.github/workflows/'+TEST_WORKFLOW+'@'+TEST_REF,run_id:'123456',run_attempt:'1',event_name:'workflow_dispatch',environment:'creator-evidence-synthetic-test',runner_environment:'github-hosted',sub:'repo:doom404official-collab/DOOM404:environment:creator-evidence-synthetic-test',audience:url+'/api/creator-evidence-test/upload',startsAt:now-1,expiresAt:now+120};return {version:1,projectRef:'acwmtobcbpkjfqiatyke',vercelProjectId:'prj_AbsbiTw8Kc8axGpZ3FFpH9VvDS4e',deploymentId:'dpl_synthetic',deploymentUrl:url,commit:m.sha,approvalRef:'synthetic-fixture-not-approval',uploadUid:U,readUid:R,objectKey:TEST_OBJECT,payloadSha256:TEST_HASH,byteLength:75,upload:m,readback:{...m,run_id:'123457',audience:url+'/api/creator-evidence-test/verify'}};}
const temp=mkdtempSync(tmpdir()+'/creator-cert-');let ca;
try{execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',temp+'/key','-out',temp+'/cert','-days','1','-subj','/CN=synthetic'],{stdio:'ignore'});ca=readFileSync(temp+'/cert','utf8');}finally{rmSync(temp,{recursive:true});}
const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const storageToken=uid=>enc({alg:'RS256'})+'.'+enc({sub:uid,role:'authenticated',aud:'authenticated',iss:'https://acwmtobcbpkjfqiatyke.supabase.co/auth/v1',exp:now+600})+'.c3ludGhldGlj';
function config(){const b=binding();return {enabled:true,sealedBinding:b,deployment:{target:'preview',projectId:b.vercelProjectId,id:b.deploymentId,url,commit:b.commit,branch:TEST_REF.slice(11)},postgresConfigs:Object.fromEntries(['issuer','consumer','verifier'].map(p=>[p,{host:'db.acwmtobcbpkjfqiatyke.supabase.co',port:5432,database:'postgres',user:'creator_test_'+p+'_login',password:'synthetic-only',ca}])),storageSessions:{upload:storageToken(b.uploadUid),readback:storageToken(b.readUid)},publishableKey:'sb_publishable_synthetic'};}
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...publicKey.export({format:'jwk'}),kid:'synthetic',alg:'RS256',use:'sig'};
function token(m,override={}){const {startsAt,expiresAt,audience,...claims}=m;const d=enc({alg:'RS256',typ:'JWT',kid:'synthetic'})+'.'+enc({...claims,iss:GITHUB_ISSUER,aud:audience,iat:now,nbf:now,exp:now+120,jti:'synthetic-'+m.run_id,...override});return d+'.'+sign('RSA-SHA256',Buffer.from(d),privateKey).toString('base64url');}
function environment(c){return {VERCEL_ENV:'preview',VERCEL_TARGET_ENV:'preview',VERCEL_GIT_COMMIT_REF:TEST_REF.slice(11),VERCEL_PROJECT_ID:c.deployment.projectId,VERCEL_DEPLOYMENT_ID:c.deployment.id,VERCEL_URL:url.slice(8),VERCEL_GIT_COMMIT_SHA:c.deployment.commit,CREATOR_MACHINE_PUBLISHABLE_KEY:'sb_publishable_synthetic',CREATOR_MACHINE_UPLOAD_PASSWORD:'synthetic',CREATOR_MACHINE_READBACK_PASSWORD:'synthetic',CREATOR_TEST_DB_CA_PEM:ca,CREATOR_TEST_DB_ISSUER_PASSWORD:'synthetic',CREATOR_TEST_DB_CONSUMER_PASSWORD:'synthetic',CREATOR_TEST_DB_VERIFIER_PASSWORD:'synthetic'};}
function setup(t,{storageHook,authHook}={}){
 const trace=[],attempts=new Set(),c=config(),env=environment(c);let record,used=false,read=false,stored,time=now,puts=0,gets=0,queries=0;
 t.mock.method(Client.prototype,'connect',async()=>{});t.mock.method(Client.prototype,'end',async()=>{});
 t.mock.method(Client.prototype,'query',async function(q){queries++;const v=JSON.parse(q.values[0]);let result;
  trace.push(q.text.match(/\.(\w+)\(/)[1]);
  if(q.text.includes('.relay_session_binding(')){assert.equal(this.user,'creator_test_'+(v.action==='verify'?'verifier':'issuer')+'_login');result=c.sealedBinding;}
  else if(q.text.includes('.relay_auth_attempt(')){result=!attempts.has(v.phase);attempts.add(v.phase);}
  else if(q.text.includes('.relay_reserve(')){result=!record;if(result)record=v;}
  else if(q.text.includes('.relay_consume(')){result=used?null:record;used=true;}
  else if(q.text.includes('.relay_readback(')){result=read?null:record;read=true;}
  else assert.fail('unapproved query');return {rows:[{result}]};
 });
 const h=createCreatorSyntheticEndpoint({enabled:true},{readVariable:k=>{trace.push('read:'+k);return env[k];},now:()=>time*1000,fetchImpl:async(u,o)=>{
  if(u===GITHUB_JWKS)return Response.json({keys:[jwk]});
  if(u.includes('/auth/v1/token')){const phase=JSON.parse(o.body).email==='doom404official@gmail.com'?'upload':'readback';trace.push('auth:'+phase);if(authHook)return authHook(phase);return Response.json(authResponse(phase==='upload'?U:R,now));}
  trace.push(o.method==='POST'?'storage:put':'storage:read');
  assert.ok(u.endsWith('/'+TEST_OBJECT));
  if(o.method==='POST'){puts++;if(storageHook)return storageHook(o);assert.equal(stored,undefined);stored=Buffer.from(o.body);return Response.json({});}
  gets++;return new Response(stored);
 }});
 const invoke=(action,overrides={})=>{const m=action==='upload'?c.sealedBinding.upload:c.sealedBinding.readback;return runCreatorSyntheticAttempt({enabled:true,action,manifest:m,identity:m,...overrides},{now:()=>time*1000,getOidcToken:async()=>token(m),fetchImpl:async(u,o)=>h(new Request(u,o))});};
 return {c,env,h,invoke,trace,attempts,setTime:t=>{time=t;},counts:()=>({puts,gets,queries})};
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
test('wrong Auth role preserves consumed claims but never writes Storage',async t=>{
 const s=setup(t,{authHook:()=>Response.json(authResponse(U,now,{role:'service_role'}))});
 assert.equal((await s.invoke('upload')).status,'RECONCILIATION_REQUIRED');assert.equal(s.counts().puts,0);assert.ok(s.attempts.has('upload'));
});
test('malformed bearer/body is rejected before configuration or body reads',async()=>{
 const h=createCreatorSyntheticEndpoint({enabled:true},{readVariable:()=>assert.fail('no secret')});
 assert.equal((await h(new Request(url+'/api/creator-evidence-test/issue',{method:'POST',headers:{authorization:'Bearer malformed'},body:'{}'}))).status,404);
});

for(const [label,override] of Object.entries({
 forged:null,issuer:{iss:'https://forged.invalid'},audience:{aud:url+'/api/creator-evidence-test/verify'},
 expired:{exp:now},future:{nbf:now+1},repository:{repository:'other/repo'},repositoryId:{repository_id:'1'},owner:{repository_owner:'other'},ownerId:{repository_owner_id:'1'},
 ref:{ref:'refs/heads/main'},commit:{sha:'b'.repeat(40)},workflowCommit:{workflow_sha:'b'.repeat(40)},workflow:{workflow_ref:'other'},
 subject:{sub:'other'},environment:{environment:'other'},attempt:{run_attempt:'2'},event:{event_name:'push'},runner:{runner_environment:'self-hosted'},runId:{run_id:'invalid'}
}))test('bootstrap '+label+' rejects before secrets SQL and body',async t=>{
 const c=config(),env=environment(c);let secrets=0,queries=0,bodies=0,jwks=0;
 t.mock.method(Client.prototype,'connect',async()=>{queries++;assert.fail('SQL connection forbidden');});
 const h=createCreatorSyntheticEndpoint({enabled:true},{now:()=>now*1000,readVariable:k=>{if(k.startsWith('CREATOR_TEST_DB_'))secrets++;return env[k];},fetchImpl:async u=>{assert.equal(u,GITHUB_JWKS);jwks++;return Response.json({keys:[jwk]});}});
 let bearer=token(c.sealedBinding.upload,override??{});
 if(label==='forged'){const parts=bearer.split('.');parts[2]=Buffer.alloc(256,1).toString('base64url');bearer=parts.join('.');}
 const request={url:url+'/api/creator-evidence-test/issue',method:'POST',headers:new Headers({authorization:'Bearer '+bearer}),signal:new AbortController().signal,get body(){bodies++;throw Error('body accessed');},get arrayBuffer(){bodies++;throw Error('body accessed');},get json(){bodies++;throw Error('body accessed');}};
 assert.equal((await h(request)).status,404);assert.deepEqual({secrets,queries,bodies},{secrets:0,queries:0,bodies:0});assert.equal(jwks,1);
});
test('genuine stale installed envelope stops after authenticated configuration read',async t=>{
 const s=setup(t),m=structuredClone(s.c.sealedBinding.upload);
 s.c.sealedBinding.upload.expiresAt=now-1;s.c.sealedBinding.upload.startsAt=now-121;
 const response=await s.h(new Request(url+'/api/creator-evidence-test/issue',{method:'POST',headers:{authorization:'Bearer '+token(m)},body:'{}'}));
 assert.equal(response.status,404);assert.deepEqual(s.counts(),{puts:0,gets:0,queries:1});
});
test('authenticated different run still fails exact installed seal before body or claims',async t=>{
 const s=setup(t);let bodies=0;
 const request={url:url+'/api/creator-evidence-test/issue',method:'POST',headers:new Headers({authorization:'Bearer '+token(s.c.sealedBinding.upload,{run_id:'999999'})}),signal:new AbortController().signal,get body(){bodies++;throw Error('body accessed');}};
 assert.notEqual((await s.h(request)).status,200);assert.equal(bodies,0);assert.equal(s.trace.some(x=>x.includes('MACHINE_UPLOAD_PASSWORD')||x.startsWith('auth:')),false);assert.deepEqual(s.counts(),{puts:0,gets:0,queries:1});
});

test('ordered complete endpoint: issue has no Auth, upload/readback claims precede respective secrets',async t=>{
 const s=setup(t);assert.equal((await s.invoke('upload')).status,'UPLOAD_REPORTED');assert.equal((await s.invoke('readback')).status,'READBACK_VERIFIED');
 const ordered=['relay_session_binding','relay_reserve','relay_session_binding','relay_consume','relay_auth_attempt','read:CREATOR_MACHINE_UPLOAD_PASSWORD','auth:upload','storage:put','relay_session_binding','relay_readback','relay_auth_attempt','read:CREATOR_MACHINE_READBACK_PASSWORD','auth:readback','storage:read'];
 assert.deepEqual(s.trace.filter(x=>ordered.includes(x)),ordered);
});
test('readback Auth uncertainty survives Storage/relay/HTTP as reconciliation',async t=>{
 const s=setup(t,{authHook:phase=>phase==='upload'?Response.json(authResponse(U,now)):Promise.reject(Error('PRIVATE_PROVIDER_DETAIL'))});
 assert.equal((await s.invoke('upload')).status,'UPLOAD_REPORTED');const r=await s.invoke('readback');assert.equal(r.status,'RECONCILIATION_REQUIRED');assert.ok(!JSON.stringify(r).includes('PRIVATE'));assert.equal(s.counts().gets,0);assert.ok(s.attempts.has('readback'));
 await s.invoke('readback');assert.equal(s.trace.filter(x=>x==='auth:readback').length,1);
});
test('readback cancellation after Auth dispatch remains HTTP reconciliation even with late completion',async t=>{
 const a=new AbortController();let late;
 const s=setup(t,{authHook:phase=>{if(phase==='upload')return Response.json(authResponse(U,now));a.abort();return new Promise(r=>late=r);}});
 assert.equal((await s.invoke('upload')).status,'UPLOAD_REPORTED');
 const m=s.c.sealedBinding.readback;
 const r=await s.h(new Request(url+'/api/creator-evidence-test/verify',{method:'POST',headers:{authorization:'Bearer '+token(m),'content-type':'application/json'},body:'{}',signal:a.signal}));
 assert.equal(r.status,409);assert.deepEqual(await r.json(),{status:'RECONCILIATION_REQUIRED'});
 late(Response.json(authResponse(R,now)));await new Promise(r=>setImmediate(r));assert.equal(s.counts().gets,0);
});
