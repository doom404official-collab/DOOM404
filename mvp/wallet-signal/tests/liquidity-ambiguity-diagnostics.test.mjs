import test from "node:test";
import assert from "node:assert/strict";
import {diagnoseSwapAmbiguity} from "../lib/liquidityAmbiguityDiagnostics.mjs";
test("detects mixed pool operations",()=>{
 const r=diagnoseSwapAmbiguity([{operation:"buy",poolMatched:true},{operation:"sell",poolMatched:true}],{allVaultBalancesObserved:true});
 assert.ok(r.reasons.includes("MULTIPLE_OPERATION_TYPES"));
 assert.equal(r.attributionComplete,false);
});
test("reports missing vault evidence",()=>{
 const r=diagnoseSwapAmbiguity([{operation:"buy",poolMatched:true}],null);
 assert.ok(r.reasons.includes("INCOMPLETE_VAULT_BALANCES"));
 assert.equal(r.withdrawalConfirmed,false);
});
