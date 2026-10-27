import {TEST_OBJECT,TEST_HASH,TEST_WORKFLOW,TEST_REF,testBytes} from '../lib/creatorEvidenceTestProfile.mjs';
import {createCreatorSyntheticEvidenceStorage} from '../lib/creatorEvidenceStorage.mjs';
import {createCreatorEvidenceHttpHandler,createCreatorSyntheticEvidenceHttpHandler} from '../lib/creatorEvidenceHttp.mjs';
import {readCreatorEvidenceBody} from '../lib/creatorEvidenceBody.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,createHash} from 'node:crypto';
import {verifyCreatorGithubOidc,createCreatorGithubJwksResolver,GITHUB_ISSUER,GITHUB_JWKS} from '../lib/creatorEvidenceOidc.mjs';
import {createCreatorEvidenceRelay,createCreatorPreparedEvidenceRelay,createCreatorSyntheticEvidenceRelay} from '../lib/creatorEvidenceRelay.mjs';
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048}); // ephemeral synthetic keys only
const jwk={...publicKey.export({format:'jwk'}),kid:'synthetic-key',alg:'RS256',use:'sig'},jwks={keys:[jwk]},now=1800000000;
const manifest={repository:'doom404official-collab/DOOM404',repository_id:'1405094598',repository_owner:'doom404official-collab',repository_owner_id:'335732040',ref:'refs/heads/feature/creator-history-worker-500',sha:'a'.repeat(40),workflow_sha:'a'.repeat(40),workflow_ref:'doom404official-collab/DOOM404/.github/workflows/creator-global-restricted-capture.yml@refs/heads/feature/creator-history-worker-500',run_id:'123456',run_attempt:'1',event_name:'workflow_dispatch',environment:'creator-historical-capture',runner_environment:'github-hosted',sub:'synthetic-exact-approved-subject',audience:'https://relay.invalid/upload',startsAt:now-1,expiresAt:now+299};
const readManifest={...manifest,run_id:'123457',audience:'https://relay.invalid/readback'};
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
function fixture(synthetic=false){const target=synthetic?TEST_OBJECT:objectKey;let time=now,record=null,consumed=false,read=false,stored=null,puts=0,reads=0,claimsCount=0;const claims={
 async reserve(r){claimsCount++;if(record)return false;record=structuredClone(r);return true;},
 async consume(r){claimsCount++;if(consumed||!record||r.capabilityHash!==record.capabilityHash||r.payloadSha256!==record.payloadSha256||r.byteLength!==record.byteLength||time>=record.expiresAt)return null;consumed=true;return structuredClone(record);},
 async consumeReadback(){claimsCount++;if(!consumed||read)return null;read=true;return structuredClone(record);}
 };const storage={async put(k,b,o){puts++;assert.equal(k,target);assert.equal(o.overwrite,false);if(stored)return false;stored=Buffer.from(b);return true;},async read(k){reads++;assert.equal(k,target);return stored;}};
 const write=synthetic?{...manifest,ref:TEST_REF,workflow_ref:manifest.repository+'/.github/workflows/'+TEST_WORKFLOW+'@'+TEST_REF}:manifest;
 const reader=synthetic?{...write,run_id:readManifest.run_id,audience:readManifest.audience}:readManifest;
 const options={enabled:true,manifest:write,readManifest:reader,resolveJwks:async()=>jwks,claims,storage,now:()=>time*1000};
 return {options,claims,storage,relay:synthetic?createCreatorSyntheticEvidenceRelay(options):createCreatorPreparedEvidenceRelay(options),advance:n=>time+=n,get counts(){return {puts,reads,claims:claimsCount}},corrupt:()=>{stored=Buffer.from('wrong')}};
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

test('invalid signed bearer is rejected before reading any HTTP body for each action',async()=>{
 for(const action of ['issue','upload','verify']){
  const h=fixture();let reads=0;
  const handler=createCreatorEvidenceHttpHandler(h.options);
  const response=await handler({url:'https://relay.invalid/api/creator-evidence/'+action,method:'POST',headers:new Headers({authorization:'Bearer '+token(manifest,{repository:'wrong'}),'content-type':'application/json'}),get body(){reads++;throw Error('body must remain unread');}});
  assert.notEqual(response.status,200);assert.equal(reads,0);assert.deepEqual(h.counts,{puts:0,reads:0,claims:0});
 }
});

test('malformed token or prohibited JOSE header causes no JWKS fetch or body read',async()=>{
 for(const bearer of ['a.b.c',token(manifest,{}, {alg:'HS256'}),token(manifest,{}, {jku:'https://untrusted.invalid/keys'})]){
  const h=fixture();let keys=0,bodies=0;
  const handler=createCreatorEvidenceHttpHandler({...h.options,resolveJwks:async()=>{keys++;return jwks;}});
  const result=await handler({url:'https://relay.invalid/api/creator-evidence/issue',method:'POST',headers:new Headers({authorization:'Bearer '+bearer,'content-type':'application/json'}),get body(){bodies++;throw Error();}});
  assert.notEqual(result.status,200);assert.equal(keys,0);assert.equal(bodies,0);assert.equal(h.counts.claims,0);
 }
});
test('audience change does not authorize readback: independently approved distinct run is required',async()=>{
 const h=fixture();assert.throws(()=>createCreatorEvidenceRelay({...h.options,readManifest:{...manifest,audience:readManifest.audience}}),/REJECTED/);
 const cap=await h.relay.issuePrepared({token:token(),prepared});await h.relay.upload({token:token(),capability:cap.capability,payload});const before=h.counts;
 // A write job can request the read audience, but cannot claim the approved read run.
 await assert.rejects(h.relay.verifyReadback({token:token(manifest,{aud:readManifest.audience})}));assert.deepEqual(h.counts,before);
 let bodyReads=0;const handler=createCreatorEvidenceHttpHandler(h.options);
 const rejected=await handler({url:'https://relay.invalid/api/creator-evidence/verify',method:'POST',headers:new Headers({authorization:'Bearer '+token(manifest,{aud:readManifest.audience}),'content-type':'application/json'}),get body(){bodyReads++;throw Error();}});
 assert.notEqual(rejected.status,200);assert.equal(bodyReads,0);
 assert.equal((await h.relay.verifyReadback({token:token(readManifest)})).status,'READBACK_VERIFIED');
});
test('direct issue authenticates before accessing capture preflight fields',async()=>{
 const h=fixture();let accessed=0;const capture=new Proxy({}, {get(){accessed++;throw Error();}});
 await assert.rejects(createCreatorEvidenceRelay(h.options).issue({token:token(manifest,{repository:'wrong'}),capture}));assert.equal(accessed,0);assert.equal(h.counts.claims,0);
});
test('expiry after authenticated body consumption rejects before any upload claim or storage',async()=>{
 const h=fixture(),cap=await h.relay.issuePrepared({token:token(),prepared});let keys=0,reads=0;
 const handler=createCreatorEvidenceHttpHandler({...h.options,resolveJwks:async()=>{keys++;return jwks;}});
 const result=await handler({url:'https://relay.invalid/api/creator-evidence/upload',method:'POST',headers:new Headers({authorization:'Bearer '+token(),'content-type':'application/json','x-creator-capability':cap.capability}),get body(){assert.ok(keys>0);return {getReader(){return {async read(){reads++;if(reads===1){h.advance(300);return {done:false,value:payload};}return {done:true};},cancel(){}};}};}});
 assert.notEqual(result.status,200);assert.equal(h.counts.puts,0);assert.equal(h.counts.claims,1);
});


const syntheticIssue=h=>h.relay.issue({token:token(h.options.manifest),capture:{}});
test('fixed synthetic bytes are tiny, deterministic and never historical evidence',async()=>{
 assert.ok(testBytes().length<=1024);assert.equal(hash(testBytes()),TEST_HASH);assert.equal(JSON.parse(testBytes()).historicalEvidence,false);
 assert.throws(()=>createCreatorSyntheticEvidenceRelay(),/DISABLED/);const h=fixture(true);
 for(const capture of [{objectKey},{payload:'anything'},{profile:'historical'},prepared])await assert.rejects(h.relay.issue({token:token(h.options.manifest),capture}));
 await assert.rejects(h.relay.issue({token:token(),capture:{}}));assert.equal(h.counts.claims,0);
 const cap=await syntheticIssue(h);assert.equal(cap.objectKey,TEST_OBJECT);
 await assert.rejects(h.relay.upload({token:token(h.options.manifest),capability:cap.capability,payload}));assert.equal(h.counts.puts,0);
 await h.relay.upload({token:token(h.options.manifest),capability:cap.capability,payload:testBytes()});
 await assert.rejects(h.relay.verifyReadback({token:token(h.options.manifest,{aud:h.options.readManifest.audience})}));
 assert.equal((await h.relay.verifyReadback({token:token(h.options.readManifest)})).payloadSha256,TEST_HASH);
});
test('historical wrapper rejects synthetic workflow and never accepts synthetic preflight',async()=>{
 const h=fixture(true);assert.throws(()=>createCreatorEvidenceRelay(h.options));
 const old=fixture();await assert.rejects(createCreatorEvidenceRelay(old.options).issue({token:token(),capture:JSON.parse(testBytes())}));assert.equal(old.counts.claims,0);
});
test('synthetic HTTP path is fixed; one JWKS fetch per request with repeated cryptographic checks',async()=>{
 const h=fixture(true);let keys=0;const handler=createCreatorSyntheticEvidenceHttpHandler({...h.options,resolveJwks:async()=>{keys++;return jwks;}});
 const request=(action,body,policy=h.options.manifest,cap)=>new Request('https://relay.invalid/api/creator-evidence-test/'+action,{method:'POST',headers:{authorization:'Bearer '+token(policy),'content-type':'application/json',...(cap?{'x-creator-capability':cap}:{})},body});
 const forbidden=await handler(new Request('https://relay.invalid/api/creator-evidence/issue',{method:'POST'}));assert.equal(forbidden.status,404);assert.equal(keys,0);
 const issued=await handler(request('issue','{}'));assert.equal(issued.status,200);assert.equal(keys,1);const cap=await issued.json();
 const uploaded=await handler(request('upload',testBytes(),h.options.manifest,cap.capability));assert.equal(uploaded.status,200);assert.equal(keys,2);
 const read=await handler(request('verify','{}',h.options.readManifest));assert.equal(read.status,200);assert.equal(keys,3);assert.equal((await read.json()).eligibleForLivePromotion,false);
});
test('synthetic concurrent upload/readback and replay permit exactly one of each',async()=>{
 const h=fixture(true),cap=await syntheticIssue(h),args={token:token(h.options.manifest),capability:cap.capability,payload:testBytes()};
 const uploads=await Promise.allSettled([h.relay.upload(args),h.relay.upload(args)]);assert.equal(uploads.filter(x=>x.status==='fulfilled').length,1);
 const reads=await Promise.allSettled([1,2].map(()=>h.relay.verifyReadback({token:token(h.options.readManifest)})));assert.equal(reads.filter(x=>x.status==='fulfilled').length,1);
 await assert.rejects(syntheticIssue(h));assert.equal(h.counts.puts,1);assert.equal(h.counts.reads,1);
});
test('synthetic late write stays uncertain, cannot retry, separate approved run reconciles',async()=>{
 const h=fixture(true),cap=await syntheticIssue(h),original=h.storage.put;let release,started;const ready=new Promise(r=>started=r);
 h.storage.put=async(...args)=>{started();await new Promise(r=>release=r);return original(...args);};
 const controller=new AbortController(),args={token:token(h.options.manifest),capability:cap.capability,payload:testBytes()};
 const pending=h.relay.upload({...args,signal:controller.signal});await ready;controller.abort();await assert.rejects(pending,/RECONCILIATION_REQUIRED/);release();await new Promise(r=>setImmediate(r));
 await assert.rejects(h.relay.upload(args));assert.equal(h.counts.puts,1);assert.equal((await h.relay.verifyReadback({token:token(h.options.readManifest)})).status,'READBACK_VERIFIED');
});
test('synthetic expired window has no downstream activity',async()=>{
 const h=fixture(true),cap=await syntheticIssue(h),before=h.counts;h.advance(300);
 await assert.rejects(h.relay.upload({token:token(h.options.manifest),capability:cap.capability,payload:testBytes()}));await assert.rejects(h.relay.verifyReadback({token:token(h.options.readManifest)}));assert.deepEqual(h.counts,before);
});
test('synthetic Storage transport rejects historical paths and arbitrary bytes before credentials',async()=>{
 let credentials=0,requests=0;const identity=async()=>{credentials++;return 'synthetic-only';};
 const storage=createCreatorSyntheticEvidenceStorage({enabled:true,uploadIdentity:identity,readbackIdentity:identity,fetchImpl:async(url,o)=>{requests++;assert.ok(url.endsWith('/creator-historical-evidence/'+TEST_OBJECT));assert.equal(o.redirect,'error');if(o.method==='POST'){assert.equal(o.headers['x-upsert'],'false');assert.deepEqual(o.body,testBytes());return new Response('{}');}return new Response(testBytes());}});
 await assert.rejects(storage.put(objectKey,testBytes()));await assert.rejects(storage.read(objectKey));await assert.rejects(storage.put(TEST_OBJECT,payload));assert.equal(credentials,0);
 assert.equal(await storage.put(TEST_OBJECT,testBytes()),true);assert.deepEqual(await storage.read(TEST_OBJECT),testBytes());assert.equal(requests,2);
});
test('request-local JWKS is not shared across requests, and cached keys cannot bypass expiry',async()=>{
 const h=fixture(true);let keys=0;const handler=createCreatorSyntheticEvidenceHttpHandler({...h.options,resolveJwks:async()=>{keys++;return jwks;}});
 let reads=0;const result=await handler({url:'https://relay.invalid/api/creator-evidence-test/issue',method:'POST',headers:new Headers({authorization:'Bearer '+token(h.options.manifest),'content-type':'application/json'}),get body(){return {getReader(){return {async read(){if(reads++===0){h.advance(300);return {done:false,value:Buffer.from('{}')};}return {done:true};},cancel(){}};}};}});
 assert.notEqual(result.status,200);assert.equal(keys,1);assert.equal(h.counts.claims,0);
});

test('synthetic composition uses actual crypto/HTTP/claim/storage adapters, no live network',async()=>{
 const {createCreatorSyntheticTestIntegration}=await import('../lib/creatorEvidenceSyntheticIntegration.mjs');
 assert.equal((await createCreatorSyntheticTestIntegration()({})).status,404);
 const h=fixture(true);let jwksFetches=0,puts=0,reads=0,stored;
 const client=(method,name)=>({async query({text,values}){assert.equal(text,`SELECT creator_relay_test_private.${name}($1::jsonb${name==='relay_readback'?',$2::bigint':''}) AS result`);return {rows:[{result:await h.claims[method](JSON.parse(values[0]))}]};}});
 const handler=createCreatorSyntheticTestIntegration({...h.options,claimClients:{issuer:client('reserve','relay_reserve'),consumer:client('consume','relay_consume'),verifier:client('consumeReadback','relay_readback')},uploadIdentity:async()=> 'synthetic-upload-identity',readbackIdentity:async()=> 'synthetic-read-identity',fetchImpl:async(url,o)=>{
  if(url===GITHUB_JWKS){jwksFetches++;return new Response(JSON.stringify(jwks));}
  assert.ok(url.startsWith('https://acwmtobcbpkjfqiatyke.supabase.co/storage/v1/object/'));assert.ok(url.endsWith('/'+TEST_OBJECT));
  if(o.method==='POST'){puts++;assert.equal(o.headers.authorization,'Bearer synthetic-upload-identity');assert.equal(o.headers['x-upsert'],'false');assert.equal(stored,undefined);stored=Buffer.from(o.body);return new Response('{}');}
  reads++;assert.equal(o.headers.authorization,'Bearer synthetic-read-identity');return new Response(stored);
 }});
 const request=(action,body,policy=h.options.manifest,cap)=>new Request('https://relay.invalid/api/creator-evidence-test/'+action,{method:'POST',headers:{authorization:'Bearer '+token(policy),'content-type':'application/json',...(cap?{'x-creator-capability':cap}:{})},body});
 const issue=await handler(request('issue','{}'));assert.equal(issue.status,200);const cap=(await issue.json()).capability;
 assert.equal((await handler(request('upload',testBytes(),h.options.manifest,cap))).status,200);
 const verified=await handler(request('verify','{}',h.options.readManifest));assert.equal(verified.status,200);assert.equal((await verified.json()).payloadSha256,TEST_HASH);
 assert.equal(jwksFetches,3);assert.equal(puts,1);assert.equal(reads,1);
});
