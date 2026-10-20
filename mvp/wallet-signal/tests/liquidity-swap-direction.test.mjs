import test from "node:test";
import assert from "node:assert/strict";
import {assessSwapReserveDirection} from "../lib/liquiditySwapDirection.mjs";
const evidence=(base,quote)=>({allVaultBalancesObserved:true,vaults:[{rawDelta:String(base)},{rawDelta:String(quote)}]});
test("buy requires base out and quote in",()=>{
 const r=assessSwapReserveDirection([{operation:"buy",poolMatched:true}],evidence(-10,20));
 assert.equal(r.directionConsistent,true);
 assert.equal(r.withdrawalConfirmed,false);
});
test("sell requires base in and quote out",()=>{
 assert.equal(assessSwapReserveDirection([{operation:"sell",poolMatched:true}],evidence(10,-20)).directionConsistent,true);
});
test("missing evidence and conflicting operations fail closed",()=>{
 assert.equal(assessSwapReserveDirection([{operation:"buy",poolMatched:true}],null).directionConsistent,false);
 assert.equal(assessSwapReserveDirection([{operation:"buy",poolMatched:true},{operation:"sell",poolMatched:true}],evidence(-10,20)).status,"ambiguous_operations");
});
