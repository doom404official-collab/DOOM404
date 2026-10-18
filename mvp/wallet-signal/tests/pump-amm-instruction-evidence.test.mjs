import test from "node:test";
import assert from "node:assert/strict";
import {classifyPumpAmmInstruction} from "../lib/pumpAmmInstructionEvidence.mjs";
const program="pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";
test("recognizes withdraw discriminator but does not claim verification",()=>{
 const r=classifyPumpAmmInstruction(program,Buffer.from([183,18,70,156,148,109,161,34]));
 assert.equal(r.candidate,"withdraw");
 assert.equal(r.verified,false);
});
test("rejects other programs and short data",()=>{
 assert.equal(classifyPumpAmmInstruction("other",Buffer.alloc(8)).candidate,null);
 assert.equal(classifyPumpAmmInstruction(program,Buffer.alloc(7)).candidate,null);
});
