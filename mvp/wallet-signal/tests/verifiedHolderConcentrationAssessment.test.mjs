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
 const holders=Array.from({length:20},(_,i)=>({tokenAccount:"account"+i,ownerWallet:"wallet"+i,sharePct:1,amountRaw:"10"}));
 const wallets=Object.fromEntries(holders.map(h=>[h.ownerWallet,{pages:1}]));
 const r=assessVerifiedHolderConcentration({checkpoint:{holders,wallets,edges:{},snapshot:{supplyRaw:"1000",largestAccountsSlot:100,supplySlot:101,ownerSlots:Array(20).fill(102)}},evidenceRows:[],custodyClassificationComplete:true});
 assert.equal(r.components[0].score,31.5);
 assert.equal(r.components[1].score,null);
 assert.equal(r.score,null);
});
const validHolders=()=>Array.from({length:20},(_,i)=>({tokenAccount:'account'+i,ownerWallet:'wallet'+i,sharePct:1,amountRaw:'10'}));
function assess(holders,snapshot={supplyRaw:"1000",largestAccountsSlot:100,supplySlot:101,ownerSlots:Array(20).fill(102)}){return assessVerifiedHolderConcentration({checkpoint:{holders,wallets:Object.fromEntries(holders.map(h=>[h.ownerWallet,{}])),edges:{},...(snapshot?{snapshot}:{})}});}
for(const [name,mutate] of [
 ['unresolved owner',h=>h[0].ownerWallet=''],
 ['duplicate token account',h=>h[1].tokenAccount=h[0].tokenAccount],
 ['missing token account',h=>delete h[0].tokenAccount],
 ['aggregate supply overflow',h=>h.forEach(x=>x.sharePct=6)],
 ['negative share',h=>h[0].sharePct=-1],
 ['nonfinite share',h=>h[0].sharePct=NaN]
])test(name+' withholds concentration',()=>{const h=validHolders();mutate(h);const r=assess(h);assert.equal(r.components[0].score,null);assert.equal(r.status,'holder_data_incomplete');assert.equal(r.scoreCoveragePct,0);assert.equal(r.snapshotProvenanceVerified,false);});
test('distinct accounts of same owner remain valid concentration but not independence',()=>{
 const h=validHolders();h[1].ownerWallet=h[0].ownerWallet;const r=assess(h);
 assert.equal(r.components[0].score,31.5);assert.equal(r.components[3].score,null);
});
test('raw snapshot provenance must be complete and match shares',()=>{
 const h=validHolders().map(x=>({...x,amountRaw:'10'}));
 const snapshot={supplyRaw:'1000',largestAccountsSlot:100,supplySlot:101,ownerSlots:Array(20).fill(102)};
 assert.equal(assess(h,snapshot).components[0].score,31.5);
 assert.equal(assess(h,{...snapshot,supplyRaw:'0'}).components[0].score,null);
 assert.equal(assess(h,{...snapshot,supplyRaw:'1001'}).components[0].score,null);
 assert.equal(assess(h,{...snapshot,ownerSlots:Array(20).fill(99)}).components[0].score,null);
 assert.equal(assess(h,null).components[0].score,null);
 h[0].amountRaw='-1';assert.equal(assess(h,snapshot).components[0].score,null);
});

test('legacy snapshots retain observations but withhold score for missing provenance',()=>{
 const h=validHolders().map(({amountRaw,...row})=>row);const r=assess(h,null);
 assert.equal(r.components[0].score,null);assert.equal(r.components[0].reason,'SNAPSHOT_PROVENANCE_MISSING');
 assert.equal(r.snapshotProvenanceVerified,false);assert.equal(r.scoreCoveragePct,0);assert.ok(r.evidence);
});

test('exact full supply does not fail from floating point summation',()=>{
 const h=validHolders().map((x,i)=>({...x,amountRaw:i===19?'995991':'211',sharePct:i===19?99.5991:.0211}));
 const r=assess(h,{supplyRaw:'1000000',largestAccountsSlot:100,supplySlot:100,ownerSlots:Array(20).fill(100)});
 assert.equal(r.components[0].score,0);assert.equal(r.snapshotProvenanceVerified,true);assert.equal(r.scoreCoveragePct,35);
});

test("external network extraction is visible but never promotes a score",()=>{
 const sig="2".repeat(88);
 const cp={...checkpoint,signatures:{[sig]:"checked"}};
 const r=assessVerifiedHolderConcentration({checkpoint:cp,evidenceRows:[{signature:sig,status:"verified",evidence:{networkExtraction:{version:1,valid:true,unresolvedTokenTransfers:0,transfers:[]}}}]});
 assert.equal(r.externalNetworkEvidence.eligibleForReview,1);
 assert.equal(r.externalNetworkEvidence.checkpointModified,false);
 assert.equal(r.externalNetworkEvidence.scorePromoted,false);
 assert.equal(r.score,null);
});
