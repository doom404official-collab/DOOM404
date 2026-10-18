import assert from 'node:assert/strict';
import {identifyPumpFunInstructionCandidates,PUMP_FUN_PROGRAM_ID} from '../lib/pumpFunSellCandidates.mjs';
const transaction={meta:{err:null,innerInstructions:[]},transaction:{message:{
 accountKeys:[PUMP_FUN_PROGRAM_ID],instructions:[{programIdIndex:0,data:'unknown'}]}}};
const candidates=identifyPumpFunInstructionCandidates({transaction});
assert.equal(candidates.length,1);
assert.equal(candidates[0].saleVerified,false);
assert.equal(candidates[0].soldRaw,null);
assert.equal(identifyPumpFunInstructionCandidates({transaction:{...transaction,meta:{err:{InstructionError:[0,'Failed']}}}}).length,0);
console.log('Pump.fun instruction candidate tests passed');
