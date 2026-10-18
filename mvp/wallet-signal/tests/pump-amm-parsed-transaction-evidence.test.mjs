import test from "node:test";
import assert from "node:assert/strict";
import {inspectPumpAmmParsedTransaction} from "../lib/pumpAmmParsedTransactionEvidence.mjs";
test("missing transaction is unavailable",()=>{
 assert.equal(inspectPumpAmmParsedTransaction(null,"pool").withdrawalConfirmed,false);
});
test("failed transaction cannot establish withdrawal",()=>{
 const r=inspectPumpAmmParsedTransaction({meta:{err:{InstructionError:[0,1]}}},"pool");
 assert.equal(r.status,"failed_transaction");
 assert.equal(r.withdrawalConfirmed,false);
});
