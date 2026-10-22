import test from "node:test";
import assert from "node:assert/strict";
import {compareHolderInfrastructureExclusion} from "../lib/holderInfrastructureSensitivity.mjs";
const pool="6e3jZLtf4tQbWZm3f7A66jF8tfZn6MRQVrbDFgcNWarA";
const wallet="GHceWgs54Ye6iQCdk2orLgvSweaNsNa57qxaJBjAg7gA";
const extra=Array.from({length:18},(_,i)=>"111111111111111111111111111111"+String(i+10));
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
