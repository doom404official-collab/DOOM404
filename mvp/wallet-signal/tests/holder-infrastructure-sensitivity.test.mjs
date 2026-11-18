import test from "node:test";
import assert from "node:assert/strict";
import {PublicKey} from "@solana/web3.js";
import {compareHolderInfrastructureExclusion} from "../lib/holderInfrastructureSensitivity.mjs";
const pool="6e3jZLtf4tQbWZm3f7A66jF8tfZn6MRQVrbDFgcNWarA";
const wallet="GHceWgs54Ye6iQCdk2orLgvSweaNsNa57qxaJBjAg7gA";
const extra=Array.from({length:18},(_,i)=>new PublicKey(Uint8Array.from({length:32},(_,j)=>j===31?i+1:0)).toBase58());
const snapshot={id:"frozen",mint:wallet,slot:457305617,status:"frozen",supply_raw:"1000000",excluded_wallets:[],holder_ranking:[pool,wallet,...extra].map(wallet=>({wallet,balance:"1000"}))};
test("sensitivity excludes pool without modifying snapshot or promoting",()=>{
 const original=JSON.stringify(snapshot);
 const r=compareHolderInfrastructureExclusion({snapshot,transfers:[],pool});
 assert.equal(r.status,"OBSERVED_ONLY");
 assert.equal(r.scorePromoted,false);
 assert.equal(r.snapshotModified,false);
 assert.equal(r.baseline.score,35);
 assert.equal(r.excluded.score,35);
 assert.equal(JSON.stringify(snapshot),original);
});
test("rejects pool absent from frozen ranking",()=>{
 assert.throws(()=>compareHolderInfrastructureExclusion({snapshot,transfers:[],pool:"Other"}),/POOL_NOT_ELIGIBLE/);
});

test("verified direct pool edge is excluded from the observed scenario",()=>{
 const source="GHceWgs54Ye6iQCdk2orLgvSweaNsNa57qxaJBjAg7gA";
 const transfer={signature:"37WZYkLnwzcPmYdoydTRhYAoUAcFGwHYem3QGt6exoSqt8H2SCZZuB5uUZg3Dd9NyTjYr62nhaxT2VbMELDKocA6",from:pool,to:source,assetType:"SOL",amountRaw:"100",slot:450097547,verifiedOnChain:true,transferVerified:true};
 const result=compareHolderInfrastructureExclusion({snapshot,transfers:[transfer],pool});
 assert.equal(result.baseline.evidence.directPairs,1);
 assert.equal(result.excluded.evidence.directPairs,0);
 assert.equal(result.excluded.evidence.connectedHolderCount,0);
 assert.equal(result.scorePromoted,false);
});
test('pool scenario retains 19 eligible wallets without replacement, renormalization or ranking changes',()=>{
 const s=structuredClone(snapshot),before=JSON.stringify(s),signature='2'.repeat(64);
 const transfers=[{signature,from:wallet,to:pool,slot:10,assetType:'SOL',amountRaw:'1',verifiedOnChain:true,transferVerified:true},
  {signature,from:pool,to:extra[0],slot:10,assetType:'SOL',amountRaw:'1',verifiedOnChain:true,transferVerified:true}];
 const r=compareHolderInfrastructureExclusion({snapshot:s,transfers,pool});
 assert.deepEqual(r.eligibleHolderCounts,{baseline:20,excluded:19});assert.equal(r.replacementApplied,false);
 assert.equal(r.baseline.evidence.connectedHolderCount,3);assert.equal(r.excluded.evidence.connectedHolderCount,0);
 assert.equal(r.baseline.evidence.largestClusterPct,0.3);assert.equal(JSON.stringify(s),before);assert.equal(r.historyComplete,false);
});
test('excluding pool leaves unrelated direct links and raw cluster supply denominator unchanged',()=>{
 const s=structuredClone(snapshot);s.supply_raw='1000000000000000000000000';for(const h of s.holder_ranking)h.balance='10000000000000000000000';
 const t={signature:'2'.repeat(64),from:wallet,to:extra[0],slot:10,assetType:'SOL',amountRaw:'1',verifiedOnChain:true,transferVerified:true};
 const r=compareHolderInfrastructureExclusion({snapshot:s,transfers:[t],pool});
 assert.equal(r.baseline.evidence.largestClusterPct,2);assert.equal(r.excluded.evidence.largestClusterPct,2);
 assert.deepEqual(r.baseline.penalties,r.excluded.penalties);assert.equal(r.delta.score,0);
});
test('unsafe numeric raw amounts and incomplete frozen identity are rejected',()=>{
 for(const mutate of [s=>s.supply_raw=1e22,s=>s.holder_ranking[0].balance=1e22,s=>delete s.slot,s=>delete s.mint,s=>delete s.id]){
  const s=structuredClone(snapshot);mutate(s);assert.throws(()=>compareHolderInfrastructureExclusion({snapshot:s,transfers:[],pool}),/INVALID_FROZEN/);
 }
});
