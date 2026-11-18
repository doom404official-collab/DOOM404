import test from 'node:test';import assert from 'node:assert/strict';
import {obtainCreatorOwnerSessions} from '../lib/creatorEvidenceOwnerSessions.mjs';
import {binding,response,U,R,emails} from './fixtures/creator-evidence/owner-auth-fixture.mjs';
const time=1800000000;
function fixture({claims={},extra={},status=200,fetchHook,promptHook}={}){
 const calls=[],dispatches=[],b=binding(time);let clock=time;
 const options={enabled:true,sealedBinding:b,publishableKey:'sb_publishable_synthetic'};
 const deps={now:()=>clock*1000,promptSecret:async label=>promptHook?promptHook(label):label.endsWith('email')?emails[label.split(' ')[0]]:'SYNTHETIC_PASSWORD',onDispatch:p=>dispatches.push(p),fetchImpl:async(url,init)=>{calls.push({url,init});return fetchHook?fetchHook(url,init):Response.json(response(calls.length===1?U:R,time,claims,extra),{status});}};
 return {calls,dispatches,options,deps,setTime:t=>clock=t};
}
test('owner Auth disabled reads nothing',async()=>{const trap=new Proxy({},{get(){assert.fail('read');}});assert.equal(await obtainCreatorOwnerSessions({},trap),null);});
test('two one-shot pinned password grants return access tokens only',async()=>{
 const f=fixture(),s=await obtainCreatorOwnerSessions(f.options,f.deps);assert.deepEqual(Object.keys(s),['upload','readback']);assert.equal(f.calls.length,2);assert.deepEqual(f.dispatches,['upload','readback']);assert.ok(!JSON.stringify(s).includes('REFRESH'));
 for(const [index,c] of f.calls.entries()){assert.equal(c.url,'https://acwmtobcbpkjfqiatyke.supabase.co/auth/v1/token?grant_type=password');assert.equal(c.init.redirect,'error');assert.equal(c.init.headers.apikey,'sb_publishable_synthetic');assert.deepEqual(JSON.parse(c.init.body),{email:emails[index===0?'upload':'readback'],password:'SYNTHETIC_PASSWORD'});}
});
for(const [name,claims] of Object.entries({subject:{sub:R},project:{iss:'https://wrong.invalid/auth/v1'},role:{role:'service_role'},audience:{aud:'other'},expired:{exp:time-1},short:{exp:time+200},long:{exp:time+3601},future:{iat:time+1},notBefore:{nbf:time+1},anonymous:{is_anonymous:true},aal:{aal:'aal2'}}))test('owner Auth rejects '+name+' and stops before reader',async()=>{const f=fixture({claims});await assert.rejects(()=>obtainCreatorOwnerSessions(f.options,f.deps),/^Error: CREATOR_OWNER_AUTH_REJECTED$/);assert.equal(f.calls.length,1);});
for(const extra of [{user:{id:R,role:'authenticated',is_anonymous:false}},{token_type:'other'},{expires_at:time+1},{expires_in:7200},{user:{id:U,role:'authenticated',is_anonymous:false,factors:[{status:'verified'}]}}])test('owner Auth rejects inconsistent response',async()=>{const f=fixture({extra});await assert.rejects(()=>obtainCreatorOwnerSessions(f.options,f.deps));assert.equal(f.calls.length,1);});
test('wrong seal identity and broad key stop before prompts/network',async()=>{for(const change of [o=>o.sealedBinding.uploadUid=R,o=>o.publishableKey='service_role']){const f=fixture({promptHook:()=>assert.fail('prompt')});change(f.options);await assert.rejects(()=>obtainCreatorOwnerSessions(f.options,f.deps));assert.equal(f.calls.length,0);}});
test('error/redirect/malformed/oversized responses never retry or leak',async()=>{for(const fetchHook of [()=>new Response('SYNTHETIC_SECRET_ERROR',{status:400}),()=>new Response(null,{status:302}),()=>new Response('malformed',{headers:{'content-type':'application/json'}}),()=>new Response('x'.repeat(65537),{headers:{'content-type':'application/json'}})]){const f=fixture({fetchHook});await assert.rejects(()=>obtainCreatorOwnerSessions(f.options,f.deps),/^Error: CREATOR_OWNER_AUTH_REJECTED$/);assert.equal(f.calls.length,1);}});
test('second sign-in failure preserves two attempts, no retry',async()=>{const f=fixture();f.deps.fetchImpl=async()=>{f.calls.push(1);return f.calls.length===1?Response.json(response(U,time)):new Response(null,{status:401});};await assert.rejects(()=>obtainCreatorOwnerSessions(f.options,f.deps));assert.equal(f.calls.length,2);});
test('cancelled noncooperative sign-in stops after one dispatch',async()=>{const a=new AbortController();const f=fixture({fetchHook:()=>{a.abort();return new Promise(()=>{});}});f.options.signal=a.signal;await assert.rejects(()=>obtainCreatorOwnerSessions(f.options,f.deps));assert.equal(f.calls.length,1);});
test('body stall abort and late failure do not start reader',async()=>{const a=new AbortController();const f=fixture({fetchHook:()=>{setTimeout(()=>a.abort(),1);return new Response(new ReadableStream({start(){}}),{headers:{'content-type':'application/json'}});}});f.options.signal=a.signal;await assert.rejects(()=>obtainCreatorOwnerSessions(f.options,f.deps));assert.equal(f.calls.length,1);});
test('window begins while prompting: no credential transmission',async()=>{const f=fixture();f.deps.promptSecret=async()=>{f.setTime(time+120);return emails.upload;};await assert.rejects(()=>obtainCreatorOwnerSessions(f.options,f.deps));assert.equal(f.calls.length,0);});

test('reader prompt cancellation after uploader session does not repeat sign-in',async()=>{const f=fixture();f.deps.promptSecret=async label=>{if(label.startsWith('readback'))throw Error('SYNTHETIC_SECRET');return label.endsWith('email')?emails[label.split(' ')[0]]:'SYNTHETIC_PASSWORD';};await assert.rejects(()=>obtainCreatorOwnerSessions(f.options,f.deps),/^Error: CREATOR_OWNER_AUTH_REJECTED$/);assert.equal(f.calls.length,1);assert.deepEqual(f.dispatches,['upload']);});

for(const phase of ['upload','readback'])for(const kind of ['wrong','swapped'])test(phase+' '+kind+' email rejects before its password or HTTP',async()=>{
 const prompts=[],f=fixture({promptHook:label=>{prompts.push(label);const current=label.split(' ')[0];return label.endsWith('email')?(current===phase?(kind==='wrong'?'other@example.invalid':emails[current==='upload'?'readback':'upload']):emails[current]):'SYNTHETIC_PASSWORD';}});
 await assert.rejects(()=>obtainCreatorOwnerSessions(f.options,f.deps),/^Error: CREATOR_OWNER_AUTH_REJECTED$/);
 assert.ok(!prompts.includes(phase+' identity password'));
 assert.equal(f.calls.length,phase==='upload'?0:1);
 assert.deepEqual(f.dispatches,phase==='upload'?[]:['upload']);
});
test('email allowlist trims whitespace and compares case insensitively before sending canonical address',async()=>{
 const f=fixture({promptHook:label=>label.endsWith('email')?'  '+emails[label.split(' ')[0]].toUpperCase()+'  ':'SYNTHETIC_PASSWORD'});
 await obtainCreatorOwnerSessions(f.options,f.deps);
 assert.deepEqual(f.calls.map(c=>JSON.parse(c.init.body).email),[emails.upload,emails.readback]);
});
