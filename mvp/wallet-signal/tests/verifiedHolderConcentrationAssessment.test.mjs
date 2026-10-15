import test from "node:test";
import assert from "node:assert/strict";
import {assessVerifiedHolderConcentration} from "../lib/verifiedHolderConcentrationAssessment.mjs";
const A="walletA",B="walletB";
const checkpoint={holders:[{ownerWallet:A,sharePct:12},{ownerWallet:B,sharePct:8}],
 wallets:{[A]:{pages:1},[B]:{pages:1}},
 edges:{[A+"|"+B]:{walletA:A,walletB:B,signatures:["sig1"]}}};
test("verified direct transfers influence provisional connections",()=>{
 const r=assessVerifiedHolderConcentration({checkpoint,evidenceRows:[
  {signature:"sig1",status:"verified",evidence:{pairs:[A+"|"+B]}}]});
 assert.equal(r.status,"provisional_evidence_complete");
 assert.equal(r.evidence.directPairs,1);
 assert.equal(r.evidence.connectedGroups[0].combinedObservedSharePct,20);
 assert.equal(r.score,null);
 assert.ok(r.components.find(x=>x.id==="connections").score!==null);
});
test("pending evidence prevents connection component scoring",()=>{
 const r=assessVerifiedHolderConcentration({checkpoint,evidenceRows:[]});
 assert.equal(r.status,"evidence_pending");
 assert.equal(r.provisionalScore,null);
 assert.equal(r.components.find(x=>x.id==="connections").score,null);
 assert.equal(r.components.find(x=>x.id==="combined").score,null);
});
