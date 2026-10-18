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

test("recognizes inner withdraw referencing loaded pool address",()=>{
 const program="pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";
 const tx={meta:{err:null,loadedAddresses:{writable:["pool"],readonly:[]},innerInstructions:[{index:0,instructions:[{programIdIndex:0,accountKeyIndexes:[1],data:Buffer.from([183,18,70,156,148,109,161,34])}]}]},transaction:{message:{staticAccountKeys:[program],compiledInstructions:[]}}};
 const r=inspectPumpAmmParsedTransaction(tx,"pool");
 assert.equal(r.candidateOperations[0].operation,"withdraw");
 assert.equal(r.candidateOperations[0].poolMatched,true);
 assert.equal(r.candidateOperations[0].source,"inner");
 assert.equal(r.withdrawalConfirmed,false);
});
