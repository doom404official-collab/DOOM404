import test from "node:test";
import assert from "node:assert/strict";
import {PublicKey} from "@solana/web3.js";
import {compareHolderInfrastructureExclusion} from "../lib/holderInfrastructureSensitivity.mjs";
const pool="6e3jZLtf4tQbWZm3f7A66jF8tfZn6MRQVrbDFgcNWarA";
const wallet="GHceWgs54Ye6iQCdk2orLgvSweaNsNa57qxaJBjAg7gA";
const extra=Array.from({length:18},(_,i)=>new PublicKey(Uint8Array.from({length:32},(_,j)=>j===31?i+1:0)).toBase58());
const snapshot={id:"frozen",status:"frozen",supply_raw:"1000000",excluded_wallets:[],holder_ranking:[pool,wallet,...extra].map(wallet=>({wallet,balance:"1000"}))};
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
