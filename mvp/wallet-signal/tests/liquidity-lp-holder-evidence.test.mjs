import test from "node:test";
import assert from "node:assert/strict";
import {summarizeLpHolders} from "../lib/liquidityLpHolderEvidence.mjs";
test("partial inventory never claims reconciliation",()=>{
 const r=summarizeLpHolders([{tokenAccount:"account",owner:"wallet",amount:"50"}],"50",false);
 assert.equal(r.inventoryComplete,false);
 assert.equal(r.supplyReconciled,false);
 assert.equal(r.lpLockVerified,false);
});
test("complete inventory can reconcile without claiming custody",()=>{
 const r=summarizeLpHolders([{tokenAccount:"account",owner:"wallet",amount:"50"}],"50",true);
 assert.equal(r.supplyReconciled,true);
 assert.equal(r.lpCustodyVerified,false);
 assert.equal(r.withdrawalRightsVerified,false);
});

test("truthy completion flags never reconcile",()=>{
 for(const complete of ["false","true",1,{},[]]) {
  const r=summarizeLpHolders([{tokenAccount:"a",owner:"wallet",amount:"50"}],"50",complete);
  assert.equal(r.inventoryComplete,false); assert.equal(r.supplyReconciled,false);
 }
});
test("malformed, missing identity and duplicate rows cannot claim complete inventory",()=>{
 for(const extra of [{owner:"bad",amount:"bad"},{owner:"wallet",amount:"0"},{tokenAccount:"a",owner:"wallet",amount:"50"},{tokenAccount:"b",owner:"wallet",amount:0}]) {
  const r=summarizeLpHolders([{tokenAccount:"a",owner:"wallet",amount:"50"},extra],"50",true);
  assert.equal(r.inventoryComplete,false); assert.equal(r.supplyReconciled,false);
 }
});
test("distinct accounts with the same owner are retained",()=>{
 const r=summarizeLpHolders([{tokenAccount:"a",owner:"wallet",amount:"25"},{tokenAccount:"b",owner:"wallet",amount:"25"}],"50",true);
 assert.equal(r.supplyReconciled,true); assert.equal(r.holderAccounts.length,2);
});
test("noncanonical and unsafe supply inputs are rejected",()=>{
 for(const supply of [50,9007199254740992,"01","-1","1e2"]) assert.throws(()=>summarizeLpHolders([],supply,true),/INVALID_LP_HOLDER_INPUT/);
});
