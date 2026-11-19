import test from "node:test";
import assert from "node:assert/strict";
import {extractFeeSweepAccounts} from "../lib/liquidityFeeSweepAccounts.mjs";
test("maps fee sweep recipient and vault using official account order",()=>{
 const program="pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";
 const accounts=["payer","config","pool","quoteMint","tokenProgram","quoteVault","recipient","recipientATA","system","associated","eventAuthority",program];
 const tx={meta:{loadedAddresses:{writable:[],readonly:[]}},transaction:{message:{staticAccountKeys:[program,...accounts],compiledInstructions:[{programIdIndex:0,accountKeyIndexes:accounts.map((_,i)=>i+1),data:Buffer.from("20f6bf3408c949ba","hex")}]}}};
 const r=extractFeeSweepAccounts(tx,"pool");
 assert.equal(r.sweeps[0].quoteVault,"quoteVault");
 assert.equal(r.sweeps[0].recipient,"recipient");
 assert.equal(r.sweeps[0].recipientTokenAccount,"recipientATA");
 assert.equal(r.sweeps[0].poolMatched,true);
 assert.equal(r.sweeps[0].settlementVerified,false);
});
