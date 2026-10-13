import test from "node:test";
import assert from "node:assert/strict";
import { createIntelligenceVault } from "../lib/intelligenceVault.mjs";
const mint="98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump";
const creator="6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC";
test("vault reads existing attribution without external chain calls",async()=>{
  const requests=[];
  const vault=createIntelligenceVault({url:"https://example.supabase.co",serviceRoleKey:"TEST_SECRET",
    fetchImpl:async(url,opts)=>{requests.push({url,opts});return {ok:true,json:async()=>[{mint,status:"INDEXED_UNVERIFIED",indexed_creator:creator}]};}});
  const result=await vault.getAttribution(mint);
  assert.equal(result.indexed_creator,creator);
  assert.equal(requests.length,1);
  assert.equal(requests[0].opts.headers.authorization,"Bearer TEST_SECRET");
  assert.equal(requests[0].url.includes("TEST_SECRET"),false);
});
test("indexed-only update does not overwrite verified attribution",async()=>{
  let writes=0;
  const vault=createIntelligenceVault({url:"https://example.supabase.co",serviceRoleKey:"TEST_SECRET",
    fetchImpl:async(_url,opts)=>{if(opts.method==="POST")writes++;return {ok:true,json:async()=>[{status:"VERIFIED"}]};}});
  assert.equal(await vault.putIndexedAttribution({mint,indexedCreator:creator,creationTimestamp:1789500020000}),false);
  assert.equal(writes,0);
});
