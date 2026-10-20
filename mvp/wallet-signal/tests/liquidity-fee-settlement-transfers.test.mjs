import test from "node:test";
import assert from "node:assert/strict";
import {inspectFeeSettlementTransfers} from "../lib/liquidityFeeSettlementTransfers.mjs";
test("matches inner SPL transfer to fee recipient token account",()=>{
 const program="TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
 const data=Buffer.from([3,100,0,0,0,0,0,0,0]);
 const tx={transaction:{message:{staticAccountKeys:[program,"vault","recipientATA"],compiledInstructions:[]}},meta:{innerInstructions:[{index:0,instructions:[{programIdIndex:0,accountKeyIndexes:[1,2],data}]}]}};
 const result=inspectFeeSettlementTransfers(tx,{sweeps:[{poolMatched:true,accountLayoutComplete:true,quoteVault:"vault",recipientTokenAccount:"recipientATA",outerInstructionIndex:0,recipient:"recipient",operation:"sweep_creator_fee"}]});
 assert.equal(result.transfers[0].amountRaw,"100");
 assert.equal(result.transfers[0].recipient,"recipient");
 assert.equal(result.settlementVerified,false);
});
test("ignores transfers to unrelated destinations",()=>{
 const tx={transaction:{message:{staticAccountKeys:["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA","vault","other"]}},meta:{innerInstructions:[{index:0,instructions:[{programIdIndex:0,accountKeyIndexes:[1,2],data:Buffer.from([3,1,0,0,0,0,0,0,0])}]}]}};
 assert.equal(inspectFeeSettlementTransfers(tx,{sweeps:[{poolMatched:true,accountLayoutComplete:true,quoteVault:"vault",recipientTokenAccount:"recipientATA",outerInstructionIndex:0}]}).matchedTransferCount,0);
});

test("rejects matching accounts under unrelated parent instruction",()=>{
 const program="TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
 const tx={transaction:{message:{staticAccountKeys:[program,"vault","recipientATA"]}},meta:{innerInstructions:[{index:4,instructions:[{programIdIndex:0,accountKeyIndexes:[1,2],data:Buffer.from([3,1,0,0,0,0,0,0,0])}]}]}};
 const r=inspectFeeSettlementTransfers(tx,{sweeps:[{poolMatched:true,accountLayoutComplete:true,quoteVault:"vault",recipientTokenAccount:"recipientATA",outerInstructionIndex:2}]});
 assert.equal(r.matchedTransferCount,0);
});
