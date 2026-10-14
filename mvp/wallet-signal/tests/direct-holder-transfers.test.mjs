import test from "node:test";
import assert from "node:assert/strict";
import {extractDirectHolderTransfers} from "../lib/directHolderTransfers.mjs";
const wrap=(instructions,err=null)=>({slot:100,meta:{err,innerInstructions:[]},transaction:{message:{accountKeys:[],instructions}}});
test("one direct SOL transfer creates an edge",()=>{
 const t=wrap([{program:"system",parsed:{type:"transfer",info:{source:"A",destination:"B",lamports:1}}}]);
 const x=extractDirectHolderTransfers({transaction:t,signature:"sig",holderWallets:["A","B"]});
 assert.equal(x.length,1);assert.equal(x[0].directInteraction,true);
});
test("co-occurrence is not a transfer",()=>{
 const t=wrap([{program:"system",parsed:{type:"createAccount",info:{source:"A",newAccount:"B"}}}]);
 assert.equal(extractDirectHolderTransfers({transaction:t,signature:"sig",holderWallets:["A","B"]}).length,0);
});
test("failed transactions do not create connections",()=>{
 const t=wrap([{program:"system",parsed:{type:"transfer",info:{source:"A",destination:"B",lamports:1}}}],{InstructionError:[0,"Custom"]});
 assert.equal(extractDirectHolderTransfers({transaction:t,signature:"sig",holderWallets:["A","B"]}).length,0);
});
test("SPL transfers require resolved token-account owners",()=>{
 const t=wrap([{program:"spl-token",parsed:{type:"transferChecked",info:{source:"tokenA",destination:"tokenB",amount:"10"}}}]);
 const a=extractDirectHolderTransfers({transaction:t,signature:"sig",holderWallets:["A","B"],tokenAccounts:[{tokenAccount:"tokenA",ownerWallet:"A"},{tokenAccount:"tokenB",ownerWallet:"B"}]});
 assert.equal(a.length,1);
 const b=extractDirectHolderTransfers({transaction:t,signature:"sig",holderWallets:["A","B"]});
 assert.equal(b.length,0);
});
