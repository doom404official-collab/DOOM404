import {createCreatorEvidenceHttpHandler} from '../lib/creatorEvidenceHttp.mjs';
import {readCreatorEvidenceBody} from '../lib/creatorEvidenceBody.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,createHash} from 'node:crypto';
import {verifyCreatorGithubOidc,createCreatorGithubJwksResolver,GITHUB_ISSUER,GITHUB_JWKS} from '../lib/creatorEvidenceOidc.mjs';
import {createCreatorEvidenceRelay,createCreatorPreparedEvidenceRelay} from '../lib/creatorEvidenceRelay.mjs';
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048}); // ephemeral synthetic keys only
const jwk={...publicKey.export({format:'jwk'}),kid:'synthetic-key',alg:'RS256',use:'sig'},jwks={keys:[jwk]},now=1800000000;
const manifest={repository:'doom404official-collab/DOOM404',repository_id:'1405094598',repository_owner:'doom404official-collab',repository_owner_id:'335732040',ref:'refs/heads/feature/creator-history-worker-500',sha:'a'.repeat(40),workflow_sha:'a'.repeat(40),workflow_ref:'doom404official-collab/DOOM404/.github/workflows/creator-global-restricted-capture.yml@refs/heads/feature/creator-history-worker-500',run_id:'123456',run_attempt:'1',event_name:'workflow_dispatch',environment:'creator-historical-capture',runner_environment:'github-hosted',sub:'synthetic-exact-approved-subject',audience:'https://relay.invalid/upload',startsAt:now-1,expiresAt:now+299};
const readManifest={...manifest,audience:'https://relay.invalid/readback'};
const encode=v=>Buffer.from(typeof v==='string'?v:JSON.stringify(v)).toString('base64url');
let serial=0;
function token(policy=manifest,changes={},header={}){const {audience,startsAt,expiresAt,...identity}=policy;const claims={...identity,iss:GITHUB_ISSUER,aud:audience,iat:now,nbf:now,exp:now+299,jti:'synthetic-'+ ++serial,...changes};const input=encode({alg:'RS256',typ:'JWT',kid:jwk.kid,...header})+'.'+encode(claims);return input+'.'+sign('RSA-SHA256',Buffer.from(input),privateKey).toString('base64url');}
const verifyToken=t=>verifyCreatorGithubOidc(t,{manifest,jwks,nowSeconds:now});
test('cryptographic verification accepts exact signed manifest, not a boolean assertion',()=>{assert.equal(verifyToken(token()).commit,manifest.sha);assert.throws(()=>verifyToken({authenticated:true}));});
for(const key of ['repository','repository_id','repository_owner_id','ref','sha','workflow_ref','workflow_sha','run_id','run_attempt','event_name','environment','runner_environment','sub','aud','iss'])test('signed wrong '+key+' rejected',()=>assert.throws(()=>verifyToken(token(manifest,{[key]:'wrong'})),/OIDC_REJECTED/));
for(const patch of [{exp:now},{iat:now+1},{nbf:now+1},{iat:now-601},{exp:'1800000001'},{jti:''},{aud:[manifest.audience]},{job_workflow_ref:'unexpected'}])test('time/type/reusable claim rejected '+JSON.stringify(patch),()=>assert.throws(()=>verifyToken(token(manifest,patch)),/OIDC_REJECTED/));
for(const header of [{alg:'none'},{alg:'HS256'},{jku:'https://evil.invalid'},{jwk},{crit:['x']},{kid:'missing'}])test('untrusted JOSE header rejected '+JSON.stringify(Object.keys(header)),()=>assert.throws(()=>verifyToken(token(manifest,{},header)),/OIDC_REJECTED/));
test('wrong signature, ambiguous key and duplicate JSON claims fail closed',()=>{
 const t=token(),parts=t.split('.');parts[1]=encode({iss:GITHUB_ISSUER});assert.throws(()=>verifyToken(parts.join('.')));
 assert.throws(()=>verifyCreatorGithubOidc(t,{manifest,jwks:{keys:[jwk,jwk]},nowSeconds:now}));
 const input=encode({alg:'RS256',typ:'JWT',kid:jwk.kid})+'.'+encode('{"iss":"x","\\u0069ss":"y"}');assert.throws(()=>verifyToken(input+'.'+sign('RSA-SHA256',Buffer.from(input),privateKey).toString('base64url')));
});
test('pinned resolver is disabled by default, fetches no token URL and rejects redirects/errors',async()=>{
 assert.throws(()=>createCreatorGithubJwksResolver(),/DISABLED/);let calls=0;
 const resolve=createCreatorGithubJwksResolver({enabled:true,fetchImpl:async(url,o)=>{calls++;assert.equal(url,GITHUB_JWKS);assert.equal(o.redirect,'error');return new Response(JSON.stringify(jwks))}});assert.deepEqual(await resolve(),jwks);assert.equal(calls,1);
 await assert.rejects(createCreatorGithubJwksResolver({enabled:true,fetchImpl:async()=>({ok:false})})());
});
const objectKey='global/442809233/4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf/9aa57beb2b897cc175a536f170ddb25c0c8bed8ed6620c7087d8a7fb834f7d30.json';
const payload=Buffer.from('{"synthetic":"prepared-stage-only"}'),hash=b=>createHash('sha256').update(b).digest('hex');
const prepared={status:'READY_FOR_RESTRICTED_REVIEW',objectKey,payload,payloadSha256:hash(payload)};
function fixture(){let time=now,record=null,consumed=false,read=false,stored=null,puts=0,reads=0,claimsCount=0;const claims={
 async reserve(r){claimsCount++;if(record)return false;record=structuredClone(r);return true;},
 async consume(r){claimsCount++;if(consumed||!record||r.capabilityHash!==record.capabilityHash||r.payloadSha256!==record.payloadSha256||r.byteLength!==record.byteLength||time>=record.expiresAt)return null;consumed=true;return structuredClone(record);},
 async consumeReadback(){claimsCount++;if(!consumed||read)return null;read=true;return structuredClone(record);}
 };const storage={async put(k,b,o){puts++;assert.equal(k,objectKey);assert.equal(o.overwrite,false);if(stored)return false;stored=Buffer.from(b);return true;},async read(k){reads++;assert.equal(k,objectKey);return stored;}};
 const options={enabled:true,manifest,readManifest,resolveJwks:async()=>jwks,claims,storage,now:()=>time*1000};
 return {options,claims,storage,relay:createCreatorPreparedEvidenceRelay(options),advance:n=>time+=n,get counts(){return {puts,reads,claims:claimsCount}},corrupt:()=>{stored=Buffer.from('wrong')}};
}
test('default disabled wrapper and authentic preflight reject synthetic historical capture',async()=>{
 assert.throws(()=>createCreatorEvidenceRelay(),/DISABLED/);const h=fixture();await assert.rejects(createCreatorEvidenceRelay(h.options).issue({token:token(),capture:{}}));assert.deepEqual(h.counts,{puts:0,reads:0,claims:0});
});
test('real signatures drive prepared-stage reserve/upload/separately authorized hash readback',async()=>{
 const h=fixture();const cap=await h.relay.issuePrepared({token:token(),prepared});assert.equal(cap.expiresAt,now+299);assert.equal(cap.eligibleForLivePromotion,false);
 await h.relay.upload({token:token(),capability:cap.capability,payload});await assert.rejects(h.relay.verifyReadback({token:token()}));assert.equal(h.counts.reads,0);
 const result=await h.relay.verifyReadback({token:token(readManifest)});assert.deepEqual(result,{status:'READBACK_VERIFIED',payloadSha256:hash(payload),eligibleForLivePromotion:false});assert.equal(JSON.stringify(result).includes('synthetic'),false);
 await assert.rejects(h.relay.verifyReadback({token:token(readManifest)}));assert.equal(h.counts.reads,1);
});
test('concurrent capability consumption permits one upload and no replay after restart',async()=>{
 const h=fixture(),cap=await h.relay.issuePrepared({token:token(),prepared}),other=createCreatorPreparedEvidenceRelay(h.options);
 const results=await Promise.allSettled([h.relay,other].map(relay=>relay.upload({token:token(),capability:cap.capability,payload})));assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(h.counts.puts,1);
 await assert.rejects(other.issuePrepared({token:token(),prepared}));await assert.rejects(other.upload({token:token(),capability:cap.capability,payload}));assert.equal(h.counts.puts,1);
});
test('expired deployment window, tampered capability and mismatched bytes cause zero upload',async()=>{
 const h=fixture(),cap=await h.relay.issuePrepared({token:token(),prepared});await assert.rejects(h.relay.upload({token:token(),capability:'x'.repeat(43),payload}));await assert.rejects(h.relay.upload({token:token(),capability:cap.capability,payload:Buffer.from('wrong')}));h.advance(300);await assert.rejects(h.relay.upload({token:token(),capability:cap.capability,payload}));assert.equal(h.counts.puts,0);
});
test('uncertain upload consumes claim permanently; readback mismatch does not promote',async()=>{
 const h=fixture(),cap=await h.relay.issuePrepared({token:token(),prepared});h.storage.put=async()=>{throw Error('sensitive transport details')};await assert.rejects(h.relay.upload({token:token(),capability:cap.capability,payload}),{message:'CREATOR_RELAY_RECONCILIATION_REQUIRED'});await assert.rejects(h.relay.upload({token:token(),capability:cap.capability,payload}));
 const x=fixture(),c=await x.relay.issuePrepared({token:token(),prepared});await x.relay.upload({token:token(),capability:c.capability,payload});x.corrupt();await assert.rejects(x.relay.verifyReadback({token:token(readManifest)}));
});
test('expiry during reserve returns no capability and never retries reservation',async()=>{
 const h=fixture();let calls=0;h.claims.reserve=async()=>{calls++;h.advance(300);return true;};await assert.rejects(h.relay.issuePrepared({token:token(),prepared}),/RECONCILIATION_REQUIRED/);assert.equal(calls,1);assert.equal(h.counts.puts,0);
});

test('OIDC lifetime is not capability lifetime: long-lived valid token still yields bounded cap',async()=>{
 const h=fixture(),cap=await h.relay.issuePrepared({token:token(manifest,{exp:now+3600}),prepared});assert.equal(cap.expiresAt,manifest.expiresAt);assert.ok(cap.expiresAt-now<=300);
});
test('expired OIDC cannot use a still-valid capability',async()=>{const h=fixture(),cap=await h.relay.issuePrepared({token:token(),prepared});await assert.rejects(h.relay.upload({token:token(manifest,{exp:now}),capability:cap.capability,payload}));assert.equal(h.counts.puts,0);});
for(const stage of ['consume','put'])test('expiry during '+stage+' remains uncertain without retry',async()=>{
 const h=fixture(),cap=await h.relay.issuePrepared({token:token(),prepared});let calls=0;
 if(stage==='consume'){const original=h.claims.consume;h.claims.consume=async(...args)=>{calls++;const result=await original(...args);h.advance(300);return result;};}
 else h.storage.put=async()=>{calls++;h.advance(300);return true;};
 await assert.rejects(h.relay.upload({token:token(),capability:cap.capability,payload}),/RECONCILIATION_REQUIRED/);assert.equal(calls,1);await assert.rejects(h.relay.upload({token:token(),capability:cap.capability,payload}));assert.equal(calls,1);
});
test('noncooperative dispatched upload can finish late; cancellation stays uncertain, separate readback reconciles',async()=>{
 const h=fixture(),cap=await h.relay.issuePrepared({token:token(),prepared});let release,started;const ready=new Promise(r=>started=r);const original=h.storage.put;
 h.storage.put=async(...args)=>{started();await new Promise(r=>release=r);return original(...args);};
 const controller=new AbortController(),pending=h.relay.upload({token:token(),capability:cap.capability,payload,signal:controller.signal});await ready;controller.abort();await assert.rejects(pending,/RECONCILIATION_REQUIRED/);release();await new Promise(r=>setImmediate(r));
 await assert.rejects(h.relay.upload({token:token(),capability:cap.capability,payload}));assert.equal(h.counts.puts,1);assert.equal((await h.relay.verifyReadback({token:token(readManifest)})).status,'READBACK_VERIFIED');
});
test('request payload snapshots cannot mutate across asynchronous authentication',async()=>{
 const h=fixture(),cap=await h.relay.issuePrepared({token:token(),prepared}),bytes=Buffer.from(payload);let release,started;const ready=new Promise(r=>started=r);
 const relay=createCreatorPreparedEvidenceRelay({...h.options,resolveJwks:async()=>{started();await new Promise(r=>release=r);return jwks;}});
 const pending=relay.upload({token:token(),capability:cap.capability,payload:bytes});await ready;bytes.fill(0);release();await pending;assert.equal((await h.relay.verifyReadback({token:token(readManifest)})).payloadSha256,hash(payload));
});
test('wrong MIME, excessive bytes and wrong prepared path reject before upload',async()=>{
 const h=fixture(),cap=await h.relay.issuePrepared({token:token(),prepared});
 for(const change of [{contentType:'application/octet-stream'},{payload:Buffer.alloc(1048577)}])await assert.rejects(h.relay.upload({token:token(),capability:cap.capability,payload,...change}));
 await assert.rejects(h.relay.issuePrepared({token:token(),prepared:{...prepared,objectKey:'../wrong'}}));assert.equal(h.counts.puts,0);
});
test('bounded body reader rejects declared/chunked excess, byte-count mismatch and cancellation',async()=>{
 for(const input of [new Response('abc',{headers:{'content-length':'3'}}),new Response('abc'),new Response('a',{headers:{'content-length':'2'}})])await assert.rejects(readCreatorEvidenceBody(input,{maxBytes:2}));
 const controller=new AbortController();const pending=readCreatorEvidenceBody(new Response(new ReadableStream({pull:()=>new Promise(()=>{})})),{signal:controller.signal});controller.abort();await assert.rejects(pending);
});
test('HTTP adapter stays disabled; active offline adapter enforces fixed paths, body and MIME',async()=>{
 let touched=0;const disabled=createCreatorEvidenceHttpHandler();assert.equal((await disabled({get url(){touched++;throw Error();}})).status,404);assert.equal(touched,0);
 const h=fixture(),handler=createCreatorEvidenceHttpHandler(h.options);
 for(const [path,headers,body] of [['/wrong',{},'{}'],['/api/creator-evidence/upload?token=x',{},'{}'],['/api/creator-evidence/upload',{'content-type':'text/plain'},'{}'],['/api/creator-evidence/verify',{'content-type':'application/json'},'{"x":1}']]){
 const response=await handler(new Request('https://relay.invalid'+path,{method:'POST',headers:{authorization:'Bearer '+token(),...headers},body}));assert.notEqual(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');}
 const issue=await handler(new Request('https://relay.invalid/api/creator-evidence/issue',{method:'POST',headers:{authorization:'Bearer '+token(),'content-type':'application/json'},body:'{}'}));assert.equal(issue.status,400);assert.equal(h.counts.puts,0);
 const cap=await h.relay.issuePrepared({token:token(),prepared});
 const uploaded=await handler(new Request('https://relay.invalid/api/creator-evidence/upload',{method:'POST',headers:{authorization:'Bearer '+token(),'content-type':'application/json','x-creator-capability':cap.capability},body:payload}));assert.equal(uploaded.status,200);
 const checked=await handler(new Request('https://relay.invalid/api/creator-evidence/verify',{method:'POST',headers:{authorization:'Bearer '+token(readManifest),'content-type':'application/json'},body:'{}'}));assert.equal(checked.status,200);assert.equal((await checked.json()).eligibleForLivePromotion,false);
});

test('RSA key strength, usage and algorithm restrictions are independent of a matching kid',()=>{
 for(const patch of [{kty:'EC'},{alg:'HS256'},{use:'enc'},{key_ops:['sign']},{d:'private'}])assert.throws(()=>verifyCreatorGithubOidc(token(),{manifest,jwks:{keys:[{...jwk,...patch}]},nowSeconds:now}));
 const weak=generateKeyPairSync('rsa',{modulusLength:1024});const parts=token().split('.'),input=parts[0]+'.'+parts[1],signed=input+'.'+sign('RSA-SHA256',Buffer.from(input),weak.privateKey).toString('base64url');
 assert.throws(()=>verifyCreatorGithubOidc(signed,{manifest,jwks:{keys:[{...weak.publicKey.export({format:'jwk'}),kid:jwk.kid,use:'sig',alg:'RS256'}]},nowSeconds:now}));
});
test('short issue-token expiry bounds capability even when upload token lasts longer',async()=>{
 const h=fixture(),cap=await h.relay.issuePrepared({token:token(manifest,{exp:now+2}),prepared});assert.equal(cap.expiresAt,now+2);h.storage.put=async()=>{h.advance(3);return true;};await assert.rejects(h.relay.upload({token:token(),capability:cap.capability,payload}),/RECONCILIATION_REQUIRED/);
});
