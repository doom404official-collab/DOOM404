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
 for(const supply of [50,9007199254740992,"01","-1","1e2","18446744073709551616"]) assert.throws(()=>summarizeLpHolders([],supply,true),/INVALID_LP_HOLDER_INPUT/);
});

test('conflicting duplicate LP balances/owners are Unknown in either order',()=>{
 const a={tokenAccount:'account',owner:'owner',amount:'50'};
 for(const b of [{...a,amount:'60'},{...a,owner:'other'}])for(const rows of [[a,b],[b,a]]){
  const r=summarizeLpHolders(rows,'100',true);assert.equal(r.observedRawAmount,null);assert.equal(r.conflictingAccounts,1);assert.deepEqual(r.holderAccounts,[]);assert.equal(r.inventoryComplete,false);assert.equal(r.withdrawalRightsVerified,false);
 }
});
test('inventory exceeding mint supply cannot be complete',()=>{const r=summarizeLpHolders([{tokenAccount:'a',owner:'owner',amount:'101'}],'100',true);assert.equal(r.inventoryComplete,false);assert.equal(r.observedExceedsSupply,true);assert.equal(r.supplyReconciled,false);});
