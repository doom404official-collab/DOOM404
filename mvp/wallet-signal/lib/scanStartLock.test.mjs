import test from 'node:test';
import assert from 'node:assert/strict';
import {createScanStartLock} from './scanStartLock.mjs';
const cfg={url:'https://example.supabase.co',key:'test'};
test('claim returns an opaque owner only when granted',async()=>{
 const manager=createScanStartLock({...cfg,fetchImpl:async()=>({ok:true,json:async()=>true})});
 const lock=await manager.acquire('98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump');
 assert.match(lock.owner,/^[0-9a-f-]{36}$/);
});
test('competing request gets preparing state when lock denied',async()=>{
 const manager=createScanStartLock({...cfg,fetchImpl:async()=>({ok:true,json:async()=>false})});
 assert.equal(await manager.acquire('98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump'),null);
});
test('database failure fails closed',async()=>{
 const manager=createScanStartLock({...cfg,fetchImpl:async()=>({ok:false})});
 await assert.rejects(()=>manager.acquire('98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump'));
});
