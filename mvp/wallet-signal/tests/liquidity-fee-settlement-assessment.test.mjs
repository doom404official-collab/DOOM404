import test from "node:test";
import assert from "node:assert/strict";
import {assessFeeSettlement} from "../lib/liquidityFeeSettlementAssessment.mjs";
const sweepAccounts={sweeps:[{poolMatched:true,operation:"sweep_protocol_fee",outerInstructionIndex:1,quoteVault:"vault",recipientTokenAccount:"protocol"},{poolMatched:true,operation:"sweep_creator_fee",outerInstructionIndex:2,quoteVault:"vault",recipientTokenAccount:"creator"}]};
const transfers=[{operation:"sweep_protocol_fee",outerInstructionIndex:1,parentInstructionMatched:true,source:"vault",destination:"protocol",amountRaw:"104152"},{operation:"sweep_creator_fee",outerInstructionIndex:2,parentInstructionMatched:true,source:"vault",destination:"creator",amountRaw:"2499621"}];
test("reconciles exact fee amounts without claiming authorization",()=>{
 const r=assessFeeSettlement({sweepAccounts,transferEvidence:{transfers},vaultBalanceEvidence:{vaults:[{vault:"vault",status:"observed",rawDelta:"-2603773"}]}});
 assert.equal(r.amountReconciled,true);
 assert.equal(r.unexplainedRaw,"0");
 assert.equal(r.authorizationVerified,false);
 assert.equal(r.settlementVerified,false);
});
test("rejects mismatched parent and missing amounts",()=>{
 const r=assessFeeSettlement({sweepAccounts,transferEvidence:{transfers:[{...transfers[0],outerInstructionIndex:7},transfers[1]]},vaultBalanceEvidence:{vaults:[{vault:"vault",status:"observed",rawDelta:"-2603773"}]}});
 assert.equal(r.amountReconciled,false);
});
