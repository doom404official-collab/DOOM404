import test from "node:test";
import assert from "node:assert/strict";
import {createHolderJobStore} from "../lib/holderJobStore.mjs";
test("claim and commit call expected protected RPC functions",async()=>{
 const requests=[];
 const fetchImpl=async(url,opts)=>{
  requests.push({url,opts});
  return {ok:true,status:200,json:async()=>({id:"job",version:1})};
 };
 const store=createHolderJobStore({url:"https://example.supabase.co",key:"test-secret",fetchImpl});
 await store.claim("job","worker",90);
 await store.commit("job","worker",1,{mint:"mint"},{},"partial");
 assert.ok(requests[0].url.endsWith("/rpc/glitch_claim_holder_scan"));
 assert.ok(requests[1].url.endsWith("/rpc/glitch_commit_holder_scan"));
 assert.equal(JSON.parse(requests[1].opts.body).p_expected_version,1);
 assert.equal(requests[0].opts.headers.Authorization,"Bearer test-secret");
});
test("missing private configuration fails closed",()=>{
 assert.throws(()=>createHolderJobStore({url:"",key:""}),/HOLDER_STORE_NOT_CONFIGURED/);
});
test("getById reads the exact identity without per-mint recency ordering",async()=>{
 const requests=[];
 const store=createHolderJobStore({url:"https://example.supabase.co",key:"test-secret",
  fetchImpl:async(url,opts)=>{requests.push({url,opts});return {ok:true,status:200,json:async()=>[{id:"job/one?",mint:"mint"}]};}});
 assert.equal((await store.getById("job/one?")).id,"job/one?");
 const url=new URL(requests[0].url);
 assert.equal(url.searchParams.get("id"),"eq.job/one?");
 assert.equal(url.searchParams.get("limit"),"1");
 assert.equal(url.searchParams.has("order"),false);
 assert.equal(url.searchParams.has("mint"),false);
 assert.equal(requests[0].opts.method,"GET");
 assert.equal(requests[0].opts.cache,"no-store");
});
test("getById returns null only for an empty result and rejects malformed responses",async()=>{
 let payload=[];
 const store=createHolderJobStore({url:"https://example.supabase.co",key:"test-secret",
  fetchImpl:async()=>({ok:true,status:200,json:async()=>payload})});
 assert.equal(await store.getById("missing"),null);
 payload={id:"unexpected"};
 await assert.rejects(store.getById("job"),{message:"INVALID_HOLDER_JOB_RESPONSE"});
 await assert.rejects(store.getById(""),{message:"INVALID_HOLDER_JOB_ID"});
});

test("getById rejects ambiguous or malformed rows instead of treating them as a valid identity",async()=>{
 let payload;
 const store=createHolderJobStore({url:"https://database.invalid",key:"test-only",
  fetchImpl:async()=>({ok:true,status:200,json:async()=>payload})});
 for(const rows of [[null],[false],["job"],[[]],[{id:"job"},{id:"job"}]]){
  payload=rows;
  await assert.rejects(store.getById("job"),{message:"INVALID_HOLDER_JOB_RESPONSE"});
 }
});

test('RPC distinguishes SQL no-match from malformed transport success',async()=>{
 let payload=null;
 const store=createHolderJobStore({url:'https://offline.invalid',key:'fixture',fetchImpl:async()=>({ok:true,status:200,json:async()=>payload})});
 assert.equal(await store.claim('job','worker'),null);
 payload={id:null};assert.equal(await store.claim('job','worker'),null);
 for(const bad of [{},[],false,{id:12}]){payload=bad;await assert.rejects(store.commit('job','worker',1,{}, {},'partial'),/INVALID_HOLDER_RPC_RESPONSE/);}
});
