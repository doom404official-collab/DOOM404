import test from "node:test";
import assert from "node:assert/strict";
import {assessPumpAmmWithdrawalRights} from "../lib/pumpAmmWithdrawalEvidence.mjs";
test("valid LP mint alone does not verify withdrawal rights",()=>{
 const r=assessPumpAmmWithdrawalRights({lpMintEvidence:{mintAccountVerified:true}});
 assert.equal(r.withdrawalInstructionAvailable,true);
 assert.equal(r.withdrawalRequiresLpTokens,true);
 assert.equal(r.withdrawalRightsVerified,false);
 assert.equal(r.lpSecurityPoints,null);
});
test("holder inventory flag alone cannot establish custody or locks",()=>{
 const r=assessPumpAmmWithdrawalRights({lpHolderEvidence:{complete:true}});
 assert.equal(r.lpHolderInventoryComplete,true);
 assert.equal(r.lpCustodyVerified,false);
 assert.equal(r.verifiedLockedLpAmount,null);
});
