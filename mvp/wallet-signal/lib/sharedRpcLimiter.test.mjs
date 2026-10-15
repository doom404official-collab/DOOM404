import test from 'node:test';
import assert from 'node:assert/strict';
import {createSharedRpcLimiter} from './sharedRpcLimiter.mjs';
const args={supabaseUrl:'https://example.supabase.co',serviceRoleKey:'test',providerHash:'a'.repeat(64)};
test('shared capacity reservation succeeds when granted',async()=>{
 const limiter=createSharedRpcLimiter({...args,fetchImpl:async()=>({ok:true,json:async()=>true})});
 assert.equal(await limiter.reserve(),true);
});
test('capacity denial is explicit',async()=>{
 const limiter=createSharedRpcLimiter({...args,fetchImpl:async()=>({ok:true,json:async()=>false})});
 assert.equal(await limiter.reserve(),false);
});
test('reservation backend failure does not permit request',async()=>{
 const limiter=createSharedRpcLimiter({...args,fetchImpl:async()=>({ok:false})});
 await assert.rejects(()=>limiter.reserve());
});
test('invalid capacity configuration rejected',()=>assert.throws(()=>createSharedRpcLimiter({...args,providerHash:'invalid'})));
