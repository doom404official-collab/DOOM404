import test from "node:test";
import assert from "node:assert/strict";
import { classifyPoolProgram } from "../lib/liquidityProtocolClassification.mjs";
test("recognized owner program yields candidate, not verification",()=>{
 const result=classifyPoolProgram({pairAddress:"pool",accountExists:true,accountOwnerProgram:"pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA"});
 assert.equal(result.protocolCandidate,"pump_amm");
 for(const field of ["protocolVerified","reservesVerified","lpLocksVerified","lpBurnsVerified","withdrawalRightsVerified"])assert.equal(result[field],false);
});
test("unknown or absent account never gets protocol verification",()=>{
 for(const pool of [{accountExists:true,accountOwnerProgram:"unknown"},{accountExists:false,accountOwnerProgram:"pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA"}]){
  const result=classifyPoolProgram(pool);
  assert.equal(result.protocolCandidate,null);
  assert.equal(result.protocolVerified,false);
 }
});
