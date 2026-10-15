import test from "node:test";
import assert from "node:assert/strict";
import {validateHolderEvidence} from "../lib/holderEvidenceValidator.mjs";
const A="walletA",B="walletB";
const checkpoint=(signatures)=>({wallets:{[A]:{},[B]:{}},holders:[],edges:{[A+"|"+B]:{walletA:A,walletB:B,signatures}}});
const transfer=(source=A,destination=B)=>({slot:12,meta:{err:null,innerInstructions:[]},
 transaction:{message:{instructions:[{program:"system",parsed:{type:"transfer",info:{source,destination,lamports:100}}}]}}});
test("one genuine direct transfer is weak",async()=>{
 const result=await validateHolderEvidence({checkpoint:checkpoint(["sig1"]),rpc:async()=>transfer()});
 assert.equal(result.results[0].status,"verified");
 assert.equal(result.results[0].strength,"weak");
});
test("two distinct direct transfers are moderate, not strong",async()=>{
 const result=await validateHolderEvidence({checkpoint:checkpoint(["sig1","sig2","sig2"]),rpc:async()=>transfer()});
 assert.equal(result.results[0].strength,"moderate");
 assert.equal(result.results[0].verifiedSignatures.length,2);
});
test("same transaction without direct transfer is rejected",async()=>{
 const result=await validateHolderEvidence({checkpoint:checkpoint(["sig1"]),rpc:async()=>transfer(A,"other")});
 assert.equal(result.results[0].status,"rejected");
});
test("missing RPC evidence stays unverified",async()=>{
 const result=await validateHolderEvidence({checkpoint:checkpoint(["sig1"]),rpc:async()=>null});
 assert.equal(result.results[0].status,"unverified");
 assert.equal(result.complete,false);
});
test("failed transaction is not valid evidence",async()=>{
 const tx=transfer();tx.meta.err={InstructionError:[0,"Custom"]};
 const result=await validateHolderEvidence({checkpoint:checkpoint(["sig1"]),rpc:async()=>tx});
 assert.equal(result.results[0].status,"rejected");
});
test("request budget preserves unknown rather than rejecting",async()=>{
 const result=await validateHolderEvidence({checkpoint:checkpoint(["sig1","sig2"]),maxRequests:1,rpc:async()=>transfer()});
 assert.equal(result.results[0].status,"verified");
 assert.deepEqual(result.results[0].unavailableSignatures,["sig2"]);
 assert.equal(result.requestsUsed,1);
});

test("partially verified relationship does not mean full validation complete",async()=>{
 const result=await validateHolderEvidence({checkpoint:checkpoint(["sig1","sig2"]),maxRequests:1,rpc:async()=>transfer()});
 assert.equal(result.results[0].status,"verified");
 assert.equal(result.complete,false);
});
