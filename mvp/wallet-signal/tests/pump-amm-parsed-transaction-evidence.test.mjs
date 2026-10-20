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

test("reports bounded instruction program and encoding diagnostics",()=>{
 const tx={meta:{err:null},transaction:{message:{staticAccountKeys:["program"],compiledInstructions:[{programIdIndex:0,accountKeyIndexes:[],data:Buffer.from([1,2,3])}]}}};
 const result=inspectPumpAmmParsedTransaction(tx,"pool");
 assert.equal(result.instructionCount,1);
 assert.equal(result.instructionDiagnostics[0].programId,"program");
 assert.equal(result.instructionDiagnostics[0].dataType,"bytes");
 assert.equal(result.withdrawalConfirmed,false);
});

test("records unknown Pump AMM discriminator without inventing operation",()=>{
 const program="pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";
 const tx={meta:{err:null},transaction:{message:{staticAccountKeys:[program],compiledInstructions:[{programIdIndex:0,accountKeyIndexes:[],data:Buffer.from([1,2,3,4,5,6,7,8])}]}}};
 const r=inspectPumpAmmParsedTransaction(tx,"pool");
 assert.equal(r.instructionDiagnostics[0].discriminatorHex,"0102030405060708");
 assert.equal(r.candidateOperations.length,0);
 assert.equal(r.withdrawalConfirmed,false);
});

test("identifies official Pump AMM fee sweeps without calling them withdrawals",()=>{
 const program="pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";
 for(const [hex,expected] of [["0830be07b644b7e5","sweep_protocol_fee"],["20f6bf3408c949ba","sweep_creator_fee"]]){
  const tx={meta:{err:null},transaction:{message:{staticAccountKeys:[program],compiledInstructions:[{programIdIndex:0,accountKeyIndexes:[],data:Buffer.from(hex,"hex")}]}}};
  const result=inspectPumpAmmParsedTransaction(tx,"pool");
  assert.equal(result.instructionDiagnostics[0].auxiliaryOperation,expected);
  assert.equal(result.withdrawalConfirmed,false);
  assert.equal(result.candidateOperations.length,0);
 }
});
test("marks Anchor self-CPI event tag as diagnostic only",()=>{
 const program="pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";
 const tx={meta:{err:null,innerInstructions:[{index:0,instructions:[{programIdIndex:0,accountKeyIndexes:[],data:Buffer.from("e445a52e51cb9a1d","hex")}]}]},transaction:{message:{staticAccountKeys:[program],compiledInstructions:[]}}};
 const result=inspectPumpAmmParsedTransaction(tx,"pool");
 assert.equal(result.instructionDiagnostics[0].auxiliaryOperation,"anchor_event_cpi_marker");
 assert.equal(result.withdrawalConfirmed,false);
 assert.equal(result.candidateOperations.length,0);
});
