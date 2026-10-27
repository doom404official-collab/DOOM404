import test from 'node:test';
import assert from 'node:assert/strict';
import {createCreatorEvidenceClaimStore} from '../lib/creatorEvidenceClaimStore.mjs';
import {createCreatorEvidenceStorage} from '../lib/creatorEvidenceStorage.mjs';
const key='global/442809233/4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf/9aa57beb2b897cc175a536f170ddb25c0c8bed8ed6620c7087d8a7fb834f7d30.json';
test('transport factories disabled before touching dependencies',()=>{assert.throws(()=>createCreatorEvidenceClaimStore(),/DISABLED/);assert.throws(()=>createCreatorEvidenceStorage(),/DISABLED/);});
test('claims use bounded parameters, retain prototype this and validate result types',async()=>{
 const calls=[];class Client{async query(q){assert.ok(this instanceof Client);calls.push(q);return {rows:[{result:q.text.includes('reserve')?true:null}]};}}
 const store=createCreatorEvidenceClaimStore({enabled:true,client:new Client()});assert.equal(await store.reserve({objectKey:key}),true);assert.equal(await store.consume({objectKey:key}),null);assert.equal(await store.consumeReadback({objectKey:key,deadlineSeconds:123}),null);
 assert.equal(calls.length,3);assert.equal(calls[0].text,'SELECT creator_private.relay_reserve($1::jsonb) AS result');assert.equal(calls[2].values[1],123);assert.ok(calls.every(c=>!c.text.includes(key)));
});
for(const mode of ['throw','malformed','late-abort'])test('uncertain '+mode+' claim call is redacted and not retried',async()=>{
 let calls=0;const c=new AbortController();const store=createCreatorEvidenceClaimStore({enabled:true,client:{query:async()=>{calls++;if(mode==='throw')throw Error('SECRET');if(mode==='late-abort')c.abort();return {rows:[]};}}});await assert.rejects(store.reserve({}, {signal:c.signal}),{message:'CREATOR_CLAIMS_RECONCILIATION_REQUIRED'});assert.equal(calls,1);
});
test('invalid claims input cannot query',async()=>{let calls=0;const store=createCreatorEvidenceClaimStore({enabled:true,client:{query:()=>{calls++;}}});await assert.rejects(store.reserve({x:'a'.repeat(8193)}));await assert.rejects(store.consumeReadback({deadlineSeconds:'1'}));assert.equal(calls,0);});
test('Storage uses separate identities, fixed project/object, non-upsert and bounded private read',async()=>{
 const calls=[],bytes=Buffer.from('{}');const storage=createCreatorEvidenceStorage({enabled:true,uploadIdentity:async()=>'synthetic-upload-only',readbackIdentity:async()=>'synthetic-read-only',fetchImpl:async(u,o)=>{calls.push({u,o});return new Response(bytes);}});
 assert.equal(await storage.put(key,bytes,{overwrite:false}),true);assert.deepEqual(await storage.read(key),bytes);assert.equal(calls[0].o.headers.authorization,'Bearer synthetic-upload-only');assert.equal(calls[1].o.headers.authorization,'Bearer synthetic-read-only');assert.equal(calls[0].o.headers['x-upsert'],'false');assert.ok(calls[0].u.startsWith('https://acwmtobcbpkjfqiatyke.supabase.co/'));assert.ok(calls[1].u.includes('/object/authenticated/'));assert.ok(calls.every(c=>c.o.redirect==='error'));
 const before=calls.length;await assert.rejects(storage.put('../wrong',bytes));await assert.rejects(storage.put(key,bytes,{overwrite:true}));await assert.rejects(storage.put(key,Buffer.alloc(1048577)));assert.equal(calls.length,before);
});
test('Storage dispatch error is uncertain with no retry; oversized read rejects',async()=>{let calls=0;const storage=createCreatorEvidenceStorage({enabled:true,uploadIdentity:async()=>'synthetic',readbackIdentity:async()=>'synthetic',fetchImpl:async(u,o)=>{calls++;if(o.method==='POST')throw Error('SECRET');return new Response(Buffer.alloc(1048577));}});await assert.rejects(storage.put(key,Buffer.from('{}')),{message:'CREATOR_STORAGE_RECONCILIATION_REQUIRED'});assert.equal(calls,1);await assert.rejects(storage.read(key),{message:'CREATOR_STORAGE_REJECTED'});assert.equal(calls,2);});
