import test from "node:test";
import assert from "node:assert/strict";
import {createHolderJobStore} from "../lib/holderJobStore.mjs";
test("scheduler asks database for lease-eligible oldest job",async()=>{
 let requested="";
 const fetchImpl=async(url)=>{requested=url;return {ok:true,status:200,json:async()=>[{id:"eligible"}]};};
 const store=createHolderJobStore({url:"https://example.supabase.co",key:"fake",fetchImpl});
 assert.equal((await store.getNextRunnable()).id,"eligible");
 assert.match(requested,/lease_owner\.is\.null/);
 assert.match(requested,/lease_expires_at\.lte/);
 assert.match(requested,/limit=1/);
 assert.match(requested,/select=id,mint,holder_set_hash,status,updated_at,lease_owner,lease_expires_at/);
 assert.match(requested,/order=updated_at.asc/);
});
test("scheduler returns null when database finds no eligible jobs",async()=>{
 const fetchImpl=async()=>({ok:true,status:200,json:async()=>[]});
 const store=createHolderJobStore({url:"https://example.supabase.co",key:"fake",fetchImpl});
 assert.equal(await store.getNextRunnable(),null);
});
