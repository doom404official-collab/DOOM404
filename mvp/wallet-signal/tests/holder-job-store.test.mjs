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
