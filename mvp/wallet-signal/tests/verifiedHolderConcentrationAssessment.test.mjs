import test from "node:test";
import assert from "node:assert/strict";
import {assessVerifiedHolderConcentration} from "../lib/verifiedHolderConcentrationAssessment.mjs";
const A="walletA",B="walletB";
const checkpoint={holders:[{ownerWallet:A,sharePct:12},{ownerWallet:B,sharePct:8}],wallets:{[A]:{pages:1},[B]:{pages:1}},edges:{[A+"|"+B]:{walletA:A,walletB:B,signatures:["sig1"]}}};
test("verified transfer remains evidence but cannot imply complete historical coverage",()=>{
 const r=assessVerifiedHolderConcentration({checkpoint,evidenceRows:[{signature:"sig1",status:"verified",evidence:{pairs:[A+"|"+B]}}]});
 assert.equal(r.evidence.directPairs,1);
 assert.equal(r.status,"holder_data_incomplete");
 assert.equal(r.score,null);
 assert.equal(r.components.find(x=>x.id==="connected_wallet_network").score,null);
 assert.deepEqual(r.components.map(x=>x.max),[35,35,20,10]);
});
test("pending evidence cannot generate an independence score",()=>{
 const r=assessVerifiedHolderConcentration({checkpoint,evidenceRows:[]});
 assert.equal(r.score,null);
 assert.equal(r.components.find(x=>x.id==="holder_breadth_independence").score,null);
});
test("complete top20 snapshot can assess concentration without fabricating network coverage",()=>{
 const holders=Array.from({length:20},(_,i)=>({ownerWallet:"wallet"+i,sharePct:1}));
 const wallets=Object.fromEntries(holders.map(h=>[h.ownerWallet,{pages:1}]));
 const r=assessVerifiedHolderConcentration({checkpoint:{holders,wallets,edges:{}},evidenceRows:[],custodyClassificationComplete:true});
 assert.equal(r.components[0].score,31.5);
 assert.equal(r.components[1].score,null);
 assert.equal(r.score,null);
});
