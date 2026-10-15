import test from 'node:test';
import assert from 'node:assert/strict';
import {createDeepScanQuota} from './deepScanQuota.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const settings={url:'https://example.supabase.co',serviceRoleKey:'fake',pepper:'x'.repeat(40)};
test('quota rejects missing private configuration',()=>assert.throws(()=>createDeepScanQuota({url:settings.url})));
test('quota passes only a hash to the database',async()=>{
 let payload;
 const quota=createDeepScanQuota({...settings,fetchImpl:async(_url,opts)=>{
  payload=JSON.parse(opts.body);return {ok:true,json:async()=>true};
 }});
 assert.equal(await quota.admit({requesterId:'user-123',mint}),true);
 assert.match(payload.p_requester_hash,/^[a-f0-9]{64}$/);
 assert.equal(JSON.stringify(payload).includes('user-123'),false);
});
test('quota denial is preserved',async()=>{
 const quota=createDeepScanQuota({...settings,fetchImpl:async()=>({ok:true,json:async()=>false})});
 assert.equal(await quota.admit({requesterId:'user-123',mint}),false);
});
test('quota backend failure fails closed',async()=>{
 const quota=createDeepScanQuota({...settings,fetchImpl:async()=>({ok:false,status:503})});
 await assert.rejects(()=>quota.admit({requesterId:'user-123',mint}));
});
