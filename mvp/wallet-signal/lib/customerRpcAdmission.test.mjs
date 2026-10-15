import test from 'node:test';
import assert from 'node:assert/strict';
import {createCustomerRpcAdmission} from './customerRpcAdmission.mjs';
const config={endpoint:'https://rpc.example.org/?api-key=fake',supabaseUrl:'https://example.supabase.co',
 serviceRoleKey:'test'};
test('customer admission reserves shared RPC capacity',async()=>{
 const reserve=createCustomerRpcAdmission({...config,fetchImpl:async()=>({ok:true,json:async()=>true})});
 assert.equal(await reserve(),true);
});
test('denied capacity retries within bounded wait budget',async()=>{
 let calls=0,waits=0;
 const reserve=createCustomerRpcAdmission({...config,maxWaits:2,sleep:async()=>{waits++;},
  fetchImpl:async()=>({ok:true,json:async()=>++calls===3})});
 assert.equal(await reserve(),true);assert.equal(calls,3);assert.equal(waits,2);
});
test('persistent denial fails closed',async()=>{
 const reserve=createCustomerRpcAdmission({...config,maxWaits:0,
  fetchImpl:async()=>({ok:true,json:async()=>false})});
 await assert.rejects(()=>reserve(),/RPC_SHARED_CAPACITY_EXHAUSTED/);
});
