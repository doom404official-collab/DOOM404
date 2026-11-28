import test from "node:test";
import assert from "node:assert/strict";
import {createHolderHistoryCheckpoint,recordHistoryPage,recordDecodedTransaction,summarizeHistoryCheckpoint} from "../lib/holderHistoryCheckpoint.mjs";
const holders=Array.from({length:20},(_,i)=>({ownerWallet:"wallet"+i,tokenAccount:"account"+i,sharePct:1}));
test("checkpoint tracks unique signatures and direct evidence",()=>{
 const cp=createHolderHistoryCheckpoint({mint:"mint",holders});
 recordHistoryPage(cp,{wallet:"wallet0",page:{wallet:"wallet0",signatures:["s1"],entriesSeen:1,nextCursor:"s1",providerPageExhausted:true}});
 recordHistoryPage(cp,{wallet:"wallet1",page:{wallet:"wallet1",signatures:["s1"],entriesSeen:1,nextCursor:"s1",providerPageExhausted:true}});
 assert.equal(summarizeHistoryCheckpoint(cp).signaturesDiscovered,1);
 recordDecodedTransaction(cp,{signature:"s1",transfers:[{confirmed:true,directInteraction:true,participants:["wallet0","wallet1"]}]});
 assert.equal(summarizeHistoryCheckpoint(cp).directEdges,1);
 assert.equal(summarizeHistoryCheckpoint(cp).transactionsChecked,1);
 assert.equal(summarizeHistoryCheckpoint(cp).archiveCompletenessProven,false);
});
test("unconfirmed interactions never create edges",()=>{
 const cp=createHolderHistoryCheckpoint({mint:"mint",holders});
 cp.signatures.s1="pending";
 recordDecodedTransaction(cp,{signature:"s1",transfers:[{confirmed:false,directInteraction:true,participants:["wallet0","wallet1"]}]});
 assert.equal(summarizeHistoryCheckpoint(cp).directEdges,0);
});
test("failed transactions remain visible and do not imply completion",()=>{
 const cp=createHolderHistoryCheckpoint({mint:"mint",holders});
 cp.signatures.s1="pending";
 recordDecodedTransaction(cp,{signature:"s1",error:"UNAVAILABLE"});
 assert.equal(summarizeHistoryCheckpoint(cp).transactionsFailed,1);
 assert.equal(summarizeHistoryCheckpoint(cp).providerHistoryExhausted,false);
});
