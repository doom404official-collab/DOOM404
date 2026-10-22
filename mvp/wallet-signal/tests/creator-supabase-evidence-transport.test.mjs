import test from 'node:test';
import assert from 'node:assert/strict';
import {createCreatorEvidenceTransport} from '../lib/creatorSupabaseEvidenceTransport.mjs';

const config={projectUrl:'https://example.supabase.co',serviceKey:'synthetic-only'};
test('missing credential rejected',()=>{
 assert.throws(()=>createCreatorEvidenceTransport({projectUrl:config.projectUrl}),/PRIVATE_STORAGE_CONFIGURATION_REQUIRED/);
});
test('overwrite blocked without network',async()=>{
 let calls=0;
 const t=createCreatorEvidenceTransport({...config,fetchImpl:async()=>{calls++;return {ok:true};}});
 await assert.rejects(t.upload('global/test.json',Buffer.from('a'),{overwrite:true}),/UNSAFE_EVIDENCE_UPLOAD/);
 assert.equal(calls,0);
});
test('upload targets private bucket and disables upsert',async()=>{
 let request;
 const t=createCreatorEvidenceTransport({...config,fetchImpl:async(url,options)=>{request={url,options};return {ok:true};}});
 assert.equal(await t.upload('global/test.json',Buffer.from('test')),true);
 assert.ok(request.url.endsWith('/creator-historical-evidence/global/test.json'));
 assert.equal(request.options.headers['x-upsert'],'false');
});
test('readback returns exact bytes',async()=>{
 const bytes=Buffer.from('test');
 const t=createCreatorEvidenceTransport({...config,fetchImpl:async()=>({ok:true,arrayBuffer:async()=>bytes})});
 assert.deepEqual(await t.read('global/test.json'),bytes);
});
test('unsafe key rejected without network',async()=>{
 let calls=0;
 const t=createCreatorEvidenceTransport({...config,fetchImpl:async()=>{calls++;return {ok:true};}});
 await assert.rejects(t.read('../private'),/INVALID_EVIDENCE_KEY/);
 assert.equal(calls,0);
});
