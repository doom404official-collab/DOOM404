import test from "node:test";
import assert from "node:assert/strict";
import {collectWalletSignaturePage} from "../lib/holderHistoryPagination.mjs";
test("cursor and exhaustion are explicit",async()=>{
 const r=await collectWalletSignaturePage({wallet:"A",limit:3,cursor:"older",fetchPage:async(w,o)=>{
  assert.equal(o.before,"older");return [{signature:"s3",err:null},{signature:"s2",err:null}];
 }});
 assert.deepEqual(r.signatures,["s3","s2"]);
 assert.equal(r.providerPageExhausted,true);
 assert.equal(r.archiveCompletenessProven,false);
});
test("failed signatures are skipped but cursor advances",async()=>{
 const r=await collectWalletSignaturePage({wallet:"A",limit:2,fetchPage:async()=>[
  {signature:"s2",err:{InstructionError:[0,"Custom"]}},{signature:"s1",err:null}]});
 assert.deepEqual(r.signatures,["s1"]);
 assert.equal(r.nextCursor,"s1");
});
test("duplicate signatures are rejected",async()=>{
 await assert.rejects(collectWalletSignaturePage({wallet:"A",limit:2,fetchPage:async()=>[
  {signature:"s",err:null},{signature:"s",err:null}]}),/DUPLICATE_SIGNATURE_PAGE/);
});
test("stalled cursor is rejected",async()=>{
 await assert.rejects(collectWalletSignaturePage({wallet:"A",cursor:"same",limit:1,fetchPage:async()=>[
  {signature:"same",err:null}]}),/PAGINATION_STALLED/);
});
