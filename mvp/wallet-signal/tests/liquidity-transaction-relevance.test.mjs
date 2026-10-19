import test from "node:test";
import assert from "node:assert/strict";
import {assessPoolTransactionRelevance} from "../lib/liquidityTransactionRelevance.mjs";
test("identifies target pool operation",()=>{
 const r=assessPoolTransactionRelevance([{operation:"buy",poolMatched:true}],null);
 assert.equal(r.status,"target_pool_operation");
 assert.equal(r.withdrawalConfirmed,false);
});
test("separates other pool operation",()=>{
 const r=assessPoolTransactionRelevance([{operation:"sell",poolMatched:false}],null);
 assert.equal(r.status,"other_pool_operation");
});
test("reports target vault evidence without instruction match",()=>{
 const r=assessPoolTransactionRelevance([],{vaults:[{status:"observed"}]});
 assert.equal(r.status,"target_vault_interaction_without_recognized_operation");
 assert.equal(r.attributionVerified,false);
});
