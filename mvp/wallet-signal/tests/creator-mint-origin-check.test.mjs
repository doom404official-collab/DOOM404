import test from "node:test";
import assert from "node:assert/strict";
import { verifyIndexedCreatorViaMint } from "../lib/creatorMintOriginCheck.mjs";
const mint="98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump";
const creator="6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC";
const epoch=1789500020;
test("mint search skips newer signatures and retains a safe checkpoint",async()=>{
  const entries=[{signature:"newer",blockTime:epoch+10000,err:null},{signature:"near1",blockTime:epoch,err:null},{signature:"near2",blockTime:epoch,err:null}];
  const lookupSignaturePage=async(_,{before}={})=>({entries:before?entries.slice(entries.findIndex(x=>x.signature===before)+1):entries,nextCursor:"near2",exhausted:true});
  const fetchTransaction=async()=>({meta:{err:null},transaction:{message:{instructions:[]}}});
  const first=await verifyIndexedCreatorViaMint({mint,indexedCreator:creator,createdTimestamp:epoch*1000,lookupSignaturePage,fetchTransaction,maxTransactions:1});
  assert.equal(first.nextCursor,"near1");assert.equal(first.newerThanWindow,1);assert.equal(first.inspected,1);
  const second=await verifyIndexedCreatorViaMint({mint,indexedCreator:creator,createdTimestamp:epoch*1000,lookupSignaturePage,fetchTransaction,maxTransactions:1,before:first.nextCursor});
  assert.equal(second.nextCursor,"near2");assert.equal(second.inspected,1);
});
test("unrelated transactions cannot establish creator",async()=>{
  const result=await verifyIndexedCreatorViaMint({mint,indexedCreator:creator,createdTimestamp:epoch*1000,
    lookupSignaturePage:async()=>({entries:[{signature:"unrelated",blockTime:epoch,err:null}],nextCursor:"unrelated",exhausted:true}),
    fetchTransaction:async()=>({meta:{err:null},transaction:{message:{instructions:[]}}})});
  assert.equal(result.status,"INDEXED_UNVERIFIED");assert.equal(result.creationSignature,null);
});
