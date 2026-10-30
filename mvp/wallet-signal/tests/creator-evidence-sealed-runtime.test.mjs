import test from 'node:test';
import assert from 'node:assert/strict';
import {Client} from 'pg';
import {generateKeyPairSync,sign} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {createCreatorSealedRuntime} from '../lib/creatorEvidenceSealedRuntime.mjs';
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
const dependencies={now:()=>now*1000,fetchImpl:async()=>{assert.fail('No network expected');}};
test('disabled ignores credential getters and malformed request without I/O',async()=>{
 const h=createCreatorSealedRuntime({get sealedBinding(){assert.fail('read');}},dependencies);assert.equal((await h(null)).status,404);
});
test('runtime accepts an active seal while SQL preparation remains future-only',()=>{
 assert.deepEqual(validateCreatorSealedBinding(binding(),{phase:'runtime',nowSeconds:now}),binding());
 assert.throws(()=>renderCreatorSealedTransition(binding(),{phase:'runtime',nowSeconds:now}),/REJECTED/);
 createCreatorSealedRuntime(config(),dependencies);
});
for(const [name,change] of Object.entries({missing:c=>delete c.sealedBinding,extra:c=>c.serviceRole='forbidden',expired:c=>{c.sealedBinding.upload.expiresAt=now;c.sealedBinding.readback.expiresAt=now;},sameRun:c=>c.sealedBinding.readback.run_id=c.sealedBinding.upload.run_id,production:c=>c.deployment.target='production',wrongDeployment:c=>c.deployment.id='dpl_other',wrongCommit:c=>c.deployment.commit='b'.repeat(40),wrongBranch:c=>c.deployment.branch='main',project:c=>c.deployment.projectId='wrong',broadUser:c=>c.postgresConfigs.issuer.user='postgres',swappedUser:c=>c.postgresConfigs.consumer.user='creator_test_issuer_login',wrongHost:c=>c.postgresConfigs.issuer.host='localhost',pooler:c=>c.postgresConfigs.issuer.port=6543,connectionString:c=>c.postgresConfigs.issuer.connectionString='forbidden',invalidCA:c=>c.postgresConfigs.issuer.ca='bad',sameStorage:c=>c.storageSessions.readback=c.storageSessions.upload,broadStorage:c=>c.storageSessions.upload='sb_secret_no',expiredStorage:c=>c.storageSessions.upload=enc({alg:'RS256'})+'.'+enc({sub:c.sealedBinding.uploadUid,role:'authenticated',aud:'authenticated',iss:'https://acwmtobcbpkjfqiatyke.supabase.co/auth/v1',exp:now})+'.c3ln'}))test('closed configuration rejects '+name,()=>{const c=config();change(c);assert.throws(()=>createCreatorSealedRuntime(c,dependencies),/SEALED_RUNTIME_REJECTED/);});
test('before/after window and wrong origin stop before body/JWKS/store',async()=>{
 let time=now-5;const c=config(),h=createCreatorSealedRuntime(c,{...dependencies,now:()=>time*1000});
 const request=origin=>new Request(origin+'/api/creator-evidence-test/issue',{method:'POST',body:'{}'});
 assert.equal((await h(request(url))).status,404);time=now;assert.equal((await h(request('https://wrong.invalid'))).status,404);time=now+120;assert.equal((await h(request(url))).status,404);
});
test('actual composition uses sealed manifests, three identities, signatures and one-shot mocks',async t=>{
 let queries=0,connections=0,record,used=false,read=false,stored,puts=0,reads=0,keys=0,time=now;
 t.mock.method(Client.prototype,'connect',async function(){connections++;});
 t.mock.method(Client.prototype,'end',async function(){});
 t.mock.method(Client.prototype,'query',async function(q){queries++;const value=JSON.parse(q.values[0]);let result;
  if(q.text.includes('.relay_reserve(')){assert.equal(this.user,'creator_test_issuer_login');result=!record;if(result)record=value;}
  else if(q.text.includes('.relay_consume(')){assert.equal(this.user,'creator_test_consumer_login');result=used?null:record;used=true;}
  else{assert.ok(q.text.includes('.relay_readback('));assert.equal(this.user,'creator_test_verifier_login');result=read?null:record;read=true;}
  return {rows:[{result}]};
 });
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048}),jwk={...publicKey.export({format:'jwk'}),kid:'synthetic',alg:'RS256',use:'sig'};
 const c=config(),b=structuredClone(c.sealedBinding);
 const token=m=>{const {startsAt,expiresAt,audience,...claims}=m;const data=enc({alg:'RS256',typ:'JWT',kid:jwk.kid})+'.'+enc({...claims,iss:GITHUB_ISSUER,aud:audience,iat:now,nbf:now,exp:now+120,jti:'synthetic-'+m.run_id});return data+'.'+sign('RSA-SHA256',Buffer.from(data),privateKey).toString('base64url');};
 const h=createCreatorSealedRuntime(c,{now:()=>time*1000,fetchImpl:async(u,o)=>{
  if(u===GITHUB_JWKS){keys++;return Response.json({keys:[jwk]});}
  assert.ok(u.endsWith('/'+TEST_OBJECT));assert.equal(o.headers.apikey,'sb_publishable_synthetic');
  if(o.method==='POST'){assert.equal(o.headers.authorization,'Bearer '+storageToken(b.uploadUid));puts++;assert.equal(stored,undefined);stored=Buffer.from(o.body);return Response.json({});}
  assert.equal(o.headers.authorization,'Bearer '+storageToken(b.readUid));reads++;return new Response(stored);
 }});
 c.sealedBinding.upload.sha='b'.repeat(40);c.postgresConfigs.issuer.user='postgres'; // immutable config snapshot
 const req=(action,m=b.upload,body='{}',cap)=>new Request(url+'/api/creator-evidence-test/'+action,{method:'POST',headers:{authorization:'Bearer '+token(m),'content-type':'application/json',...(cap?{'x-creator-capability':cap}:{})},body});
 const issue=await h(req('issue'));assert.equal(issue.status,200);const cap=(await issue.json()).capability;
 assert.notEqual((await h(req('verify'))).status,200);assert.equal(queries,1);
 assert.equal((await h(req('upload',b.upload,testBytes(),cap))).status,200);
 const verified=await h(req('verify',b.readback));assert.equal(verified.status,200);assert.equal((await verified.json()).payloadSha256,TEST_HASH);
 assert.notEqual((await h(req('upload',b.upload,testBytes(),cap))).status,200);
 assert.equal(puts,1);assert.equal(reads,1);assert.equal(connections,4);assert.equal(queries,4);
 t.mock.method(Client.prototype,'query',async function(){queries++;throw Error('synthetic uncertain transport');});
 const failed=await h(req('issue'));assert.equal(failed.status,409);assert.equal((await failed.json()).status,'RECONCILIATION_REQUIRED');assert.equal(queries,5);
 const count=keys;time=now+120;assert.equal((await h(req('issue'))).status,404);assert.equal(keys,count);assert.equal(queries,5);
});
test('later independent readback window remains available after upload window ends',async()=>{
 const c=config();c.sealedBinding.readback.startsAt=now+120;c.sealedBinding.readback.expiresAt=now+240;
 const h=createCreatorSealedRuntime(c,{...dependencies,now:()=>(now+150)*1000});
 const req=action=>new Request(url+'/api/creator-evidence-test/'+action,{method:'POST',body:'{}'});
 assert.equal((await h(req('issue'))).status,404);
 // Authentication is required; an open read window alone grants nothing.
 assert.equal((await h(req('verify'))).status,401);
});
