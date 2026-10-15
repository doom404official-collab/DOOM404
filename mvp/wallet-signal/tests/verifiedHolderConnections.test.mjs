import test from "node:test";
import assert from "node:assert/strict";
import {summarizeVerifiedHolderConnections} from "../lib/verifiedHolderConnections.mjs";
const A="walletA",B="walletB",C="walletC";
const checkpoint={holders:[{ownerWallet:A,sharePct:10},{ownerWallet:B,sharePct:8},{ownerWallet:C,sharePct:4}],
 wallets:{[A]:{},[B]:{},[C]:{}},
 edges:{[A+"|"+B]:{walletA:A,walletB:B,signatures:["sig1","sig2"]}}};
test("only persisted verified pair evidence creates graph edges",()=>{
 const r=summarizeVerifiedHolderConnections({checkpoint,evidenceRows:[
  {signature:"sig1",status:"verified",evidence:{pairs:[A+"|"+B]}},
  {signature:"sig2",status:"rejected",evidence:{pairs:[]}}]});
 assert.equal(r.directPairs,1);
 assert.equal(r.pairs[0].transferCount,1);
 assert.equal(r.pairs[0].strength,"weak");
 assert.equal(r.evidenceComplete,true);
});
test("missing signature leaves evidence incomplete",()=>{
 const r=summarizeVerifiedHolderConnections({checkpoint,evidenceRows:[
  {signature:"sig1",status:"verified",evidence:{pairs:[A+"|"+B]}}]});
 assert.equal(r.evidenceComplete,false);
 assert.equal(r.counts.pending,1);
});
test("unrelated signatures cannot create a connection",()=>{
 const r=summarizeVerifiedHolderConnections({checkpoint,evidenceRows:[
  {signature:"other",status:"verified",evidence:{pairs:[A+"|"+B]}}]});
 assert.equal(r.directPairs,0);
});
