import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyScanUser} from './verifyScanUser.mjs';
const config={url:'https://example.supabase.co',anonKey:'public-key'};
test('rejects unauthenticated requests',async()=>assert.equal(await verifyScanUser(config),null));
test('validates user with trusted Supabase Auth endpoint',async()=>{
 const user=await verifyScanUser({...config,authorization:'Bearer test.token',fetchImpl:async(url,opts)=>{
  assert.match(url,/\/auth\/v1\/user$/);
  assert.equal(opts.headers.Authorization,'Bearer test.token');
  return {ok:true,json:async()=>({id:'123e4567-e89b-12d3-a456-426614174000'})};
 }});
 assert.equal(user.id,'123e4567-e89b-12d3-a456-426614174000');
});
test('rejects invalid identity and auth denial',async()=>{
 const opts={...config,authorization:'Bearer test.token'};
 assert.equal(await verifyScanUser({...opts,fetchImpl:async()=>({ok:false})}),null);
 assert.equal(await verifyScanUser({...opts,fetchImpl:async()=>({ok:true,json:async()=>({id:'spoofed'})})}),null);
});
