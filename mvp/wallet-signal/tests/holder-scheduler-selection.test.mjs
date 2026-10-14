import test from "node:test";
import assert from "node:assert/strict";
import {createHolderJobStore} from "../lib/holderJobStore.mjs";
test("scheduler skips active leases and selects eligible job",async()=>{
 const future="2099-01-01T00:00:00Z",past="2020-01-01T00:00:00Z";
 const fetchImpl=async()=>({ok:true,status:200,json:async()=>[
  {id:"active",lease_owner:"worker",lease_expires_at:future},
  {id:"expired",lease_owner:"worker",lease_expires_at:past},
  {id:"queued",lease_owner:null,lease_expires_at:null}
 ]});
 const store=createHolderJobStore({url:"https://example.supabase.co",key:"fake",fetchImpl});
 assert.equal((await store.getNextRunnable()).id,"expired");
});
test("scheduler returns null when all leases are active",async()=>{
 const fetchImpl=async()=>({ok:true,status:200,json:async()=>[
  {id:"active",lease_owner:"worker",lease_expires_at:"2099-01-01T00:00:00Z"}
 ]});
 const store=createHolderJobStore({url:"https://example.supabase.co",key:"fake",fetchImpl});
 assert.equal(await store.getNextRunnable(),null);
});
