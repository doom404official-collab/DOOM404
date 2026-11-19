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
test("conflicting duplicate observations withhold verification in every order",()=>{
 const verified={signature:"sig1",status:"verified",evidence:{pairs:[A+"|"+B],kinds:["token"],slot:10,reason:"DIRECT_TRANSFER_PROVEN",networkExtraction:{valid:true}}};
 const differences=[{...verified,status:"rejected"},{...verified,evidence:{...verified.evidence,pairs:[A+"|"+C]}},
  {...verified,evidence:{...verified.evidence,slot:11}}, {...verified,evidence:{...verified.evidence,kinds:["native"]}},
  {...verified,evidence:{...verified.evidence,reason:"TRANSACTION_FAILED"}},
  {...verified,evidence:{...verified.evidence,networkExtraction:{valid:false}}}];
 for(const changed of differences)for(const rows of [[verified,changed],[changed,verified],[verified,changed,verified]]){
  const r=summarizeVerifiedHolderConnections({checkpoint,evidenceRows:rows});
  assert.equal(r.directPairs,0);assert.equal(r.counts.verified,0);assert.equal(r.counts.unavailable,1);
  assert.equal(r.evidenceComplete,false);assert.equal(r.historyComplete,false);assert.equal(r.commonOwnershipEstablished,false);
 }
});
test("semantic duplicate proof preserves unique-row behavior without counting attempts",()=>{
 const row={signature:"sig1",status:"verified",attempts:1,evidence:{pairs:[A+"|"+B,A+"|"+C],kinds:["token","native"],slot:10}};
 const duplicate={signature:"sig1",status:"verified",attempts:2,evidence:{slot:10,kinds:["native","token","token"],pairs:[C+"|"+A,B+"|"+A,A+"|"+B]}};
 // Preserve the existing unique-row presentation order; duplicate proof adds no edges.
 for(const rows of [[row,duplicate],[duplicate,row],[row,row]]){
  const expected=summarizeVerifiedHolderConnections({checkpoint,evidenceRows:[rows[0]]});
  assert.deepEqual(summarizeVerifiedHolderConnections({checkpoint,evidenceRows:rows}),expected);
  assert.equal(expected.counts.verified,1);assert.equal(expected.directPairs,2);
 }
});
test("invalid JSON evidence is quarantined alone, first or last without lossy coercion",()=>{
 const valid={signature:"sig1",status:"verified",evidence:{pairs:[A+"|"+B],slot:10}};
 const cycle={pairs:[A+"|"+B]};cycle.self=cycle;
 let getterReads=0;const accessor={pairs:[A+"|"+B]};Object.defineProperty(accessor,"slot",{enumerable:true,get(){getterReads++;return 10;}});
 const sparse=[];sparse.length=1;
 const invalid=[null,undefined,false,0,"",[],cycle,accessor,new Date(),
  ...[NaN,Infinity,-Infinity,undefined,()=>0,1n,Symbol("invalid"),sparse].map(value=>({pairs:[A+"|"+B],detail:value}))];
 for(const evidence of invalid){
  const bad={...valid,evidence};
  for(const rows of [[bad],[bad,valid],[valid,bad],[valid,bad,valid]]){
   const out=summarizeVerifiedHolderConnections({checkpoint,evidenceRows:rows});
   assert.equal(out.directPairs,0);assert.equal(out.counts.verified,0);assert.equal(out.counts.unavailable,1);
   assert.equal(out.evidenceComplete,false);assert.equal(out.commonOwnershipEstablished,false);
  }
 }
 assert.equal(getterReads,0);
});
