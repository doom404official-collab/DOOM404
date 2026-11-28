import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {Client} from 'pg';
import {createCreatorEnvironmentRuntime} from '../lib/creatorEvidenceEnvironment.mjs';
import {TEST_OBJECT,TEST_HASH,TEST_REF,TEST_WORKFLOW} from '../lib/creatorEvidenceTestProfile.mjs';
const now=1800000000,url='https://doom404-wallet-signal-synthetic-doom-404.vercel.app';
function binding(){const m={repository:'doom404official-collab/DOOM404',repository_id:'1405094598',repository_owner:'doom404official-collab',repository_owner_id:'335732040',ref:TEST_REF,sha:'a'.repeat(40),workflow_sha:'a'.repeat(40),workflow_ref:'doom404official-collab/DOOM404/.github/workflows/'+TEST_WORKFLOW+'@'+TEST_REF,run_id:'123456',run_attempt:'1',event_name:'workflow_dispatch',environment:'synthetic',runner_environment:'github-hosted',sub:'synthetic-only-subject',audience:url+'/api/creator-evidence-test/upload',startsAt:now-1,expiresAt:now+120};return {version:1,projectRef:'acwmtobcbpkjfqiatyke',vercelProjectId:'prj_AbsbiTw8Kc8axGpZ3FFpH9VvDS4e',deploymentId:'dpl_synthetic',deploymentUrl:url,commit:m.sha,approvalRef:'synthetic-fixture-not-approval',uploadUid:'11111111-1111-4111-8111-111111111111',readUid:'22222222-2222-4222-8222-222222222222',objectKey:TEST_OBJECT,payloadSha256:TEST_HASH,byteLength:75,upload:m,readback:{...m,run_id:'123457',audience:url+'/api/creator-evidence-test/verify'}};}
const temp=mkdtempSync(tmpdir()+'/creator-cert-');let ca;
try{execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',temp+'/key','-out',temp+'/cert','-days','1','-subj','/CN=synthetic'],{stdio:'ignore'});ca=readFileSync(temp+'/cert','utf8');}finally{rmSync(temp,{recursive:true});}
const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const storageToken=uid=>enc({alg:'RS256'})+'.'+enc({sub:uid,role:'authenticated',aud:'authenticated',iss:'https://acwmtobcbpkjfqiatyke.supabase.co/auth/v1',exp:now+600})+'.c3ludGhldGlj';
function legacyConfig(){const b=binding();return {enabled:true,sealedBinding:b,deployment:{target:'preview',projectId:b.vercelProjectId,id:b.deploymentId,url,commit:b.commit,branch:TEST_REF.slice(11)},postgresConfigs:Object.fromEntries(['issuer','consumer','verifier'].map(p=>[p,{host:'db.acwmtobcbpkjfqiatyke.supabase.co',port:5432,database:'postgres',user:'creator_test_'+p+'_login',password:'synthetic-only',ca}])),storageSessions:{upload:storageToken(b.uploadUid),readback:storageToken(b.readUid)},publishableKey:'sb_publishable_synthetic'};}

function fixture(){const c=legacyConfig();return {options:{enabled:true,sealedBinding:c.sealedBinding,storageSessions:c.storageSessions,publishableKey:c.publishableKey},env:{VERCEL_ENV:'preview',VERCEL_TARGET_ENV:'preview',VERCEL_GIT_COMMIT_REF:TEST_REF.slice(11),VERCEL_PROJECT_ID:c.deployment.projectId,VERCEL_DEPLOYMENT_ID:c.deployment.id,VERCEL_URL:url.slice(8),VERCEL_GIT_COMMIT_SHA:c.deployment.commit,CREATOR_TEST_DB_CA_PEM:ca,CREATOR_TEST_DB_ISSUER_PASSWORD:'synthetic-issuer',CREATOR_TEST_DB_CONSUMER_PASSWORD:'synthetic-consumer',CREATOR_TEST_DB_VERIFIER_PASSWORD:'synthetic-verifier'}};}
function dependencies(env,reads=[]){return {now:()=>now*1000,readVariable:k=>{reads.push(k);if(!Object.hasOwn(env,k))throw Error('secret-containing-source-error');return env[k];},fetchImpl:async()=>assert.fail('network forbidden')};}
test('disabled zero environment, secret, binding or dependency reads',async()=>{
 const h=createCreatorEnvironmentRuntime({get sealedBinding(){assert.fail('binding read');}},new Proxy({},{get(){assert.fail('dependency read');}}));
 assert.equal((await h(null)).status,404);
});
for(const flag of ['true',1,null,false])test('no truthy enable '+flag,async()=>assert.equal((await createCreatorEnvironmentRuntime({enabled:flag})(null)).status,404));
for(const key of ['VERCEL_ENV','VERCEL_TARGET_ENV','VERCEL_GIT_COMMIT_REF','VERCEL_PROJECT_ID','VERCEL_DEPLOYMENT_ID','VERCEL_URL','VERCEL_GIT_COMMIT_SHA'])test('wrong scope/identity before secrets '+key,()=>{
 const f=fixture(),reads=[];f.env[key]='wrong';assert.throws(()=>createCreatorEnvironmentRuntime(f.options,dependencies(f.env,reads)),/^Error: CREATOR_ENV_CONFIGURATION_REJECTED$/);assert.ok(!reads.some(k=>k.startsWith('CREATOR_TEST_')));
});
for(const key of ['CREATOR_TEST_DB_ISSUER_PASSWORD','CREATOR_TEST_DB_CONSUMER_PASSWORD','CREATOR_TEST_DB_VERIFIER_PASSWORD','CREATOR_TEST_DB_CA_PEM'])test('missing credential and source errors redacted '+key,()=>{const f=fixture();delete f.env[key];assert.throws(()=>createCreatorEnvironmentRuntime(f.options,dependencies(f.env)),/^Error: CREATOR_ENV_CONFIGURATION_REJECTED$/);});
for(const value of ['',null,'x\nsecret','x\0secret','x'.repeat(4097)])test('malformed password '+String(value).length,()=>{const f=fixture();f.env.CREATOR_TEST_DB_ISSUER_PASSWORD=value;assert.throws(()=>createCreatorEnvironmentRuntime(f.options,dependencies(f.env)),/CONFIGURATION_REJECTED/);});
for(const value of ['C:\cert.pem','-----BEGIN CERTIFICATE-----\\nnot-pem','invalid'])test('CA requires real PEM '+value.length,()=>{const f=fixture();f.env.CREATOR_TEST_DB_CA_PEM=value;assert.throws(()=>createCreatorEnvironmentRuntime(f.options,dependencies(f.env)),/CONFIGURATION_REJECTED/);});
for(const extra of ['host','user','postgresConfigs','connectionString'])test('reject caller override '+extra,()=>{const f=fixture();f.options[extra]='forbidden';assert.throws(()=>createCreatorEnvironmentRuntime(f.options,dependencies(f.env)),/CONFIGURATION_REJECTED/);});
test('expired seal stops before secret reads',()=>{const f=fixture(),reads=[];f.options.sealedBinding.upload.expiresAt=now;f.options.sealedBinding.readback.expiresAt=now;assert.throws(()=>createCreatorEnvironmentRuntime(f.options,dependencies(f.env,reads)),/CONFIGURATION_REJECTED/);assert.ok(!reads.some(k=>k.startsWith('CREATOR_TEST_')));});
test('valid config composes without connection, reads only explicit names and stops unauthenticated request',async t=>{
 t.mock.method(Client.prototype,'connect',()=>assert.fail('no database'));const f=fixture(),reads=[];
 const env=new Proxy(f.env,{get(target,k){assert.ok(Object.hasOwn(target,k));return target[k];},ownKeys(){assert.fail('environment enumeration');}});
 const h=createCreatorEnvironmentRuntime(f.options,dependencies(env,reads));
 assert.equal(reads.length,11);assert.equal((await h(new Request(url+'/api/creator-evidence-test/issue',{method:'POST'}))).status,401);
 assert.ok(!reads.some(k=>/SUPABASE|PGPASSWORD|DATABASE_URL|NEXT_PUBLIC/.test(k)));
});
test('Next entrypoint marks client imports forbidden and reads no ambient environment',()=>{const text=readFileSync(new URL('../lib/creatorEvidenceEnvironment.server.js',import.meta.url),'utf8');assert.match(text,/import 'server-only'/);assert.doesNotMatch(text,/process.env/);});
test('browser context cannot touch environment',()=>{globalThis.window={};try{assert.throws(()=>createCreatorEnvironmentRuntime({enabled:true},{readVariable(){assert.fail('read');}}),/CONFIGURATION_REJECTED/);}finally{delete globalThis.window;}});
