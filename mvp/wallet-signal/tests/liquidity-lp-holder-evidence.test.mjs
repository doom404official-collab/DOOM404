import test from "node:test";
import assert from "node:assert/strict";
import {summarizeLpHolders} from "../lib/liquidityLpHolderEvidence.mjs";
test("partial inventory never claims reconciliation",()=>{
 const r=summarizeLpHolders([{owner:"wallet",amount:"50"}],"50",false);
 assert.equal(r.inventoryComplete,false);
 assert.equal(r.supplyReconciled,false);
 assert.equal(r.lpLockVerified,false);
});
test("complete inventory can reconcile without claiming custody",()=>{
 const r=summarizeLpHolders([{owner:"wallet",amount:"50"}],"50",true);
 assert.equal(r.supplyReconciled,true);
 assert.equal(r.lpCustodyVerified,false);
 assert.equal(r.withdrawalRightsVerified,false);
});
