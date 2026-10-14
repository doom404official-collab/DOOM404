import test from "node:test";
import assert from "node:assert/strict";
import {scoreHolderConcentration} from "../lib/holderConcentrationScore.mjs";
test("known partial history yields weighted components but no fabricated complete score",()=>{
 const r=scoreHolderConcentration({top20SharePct:31.3817,largestAccountSharePct:5.85,
  connectedGroups:[{combinedObservedSharePct:15.3547}],connectedWallets:7,directPairs:8,
  walletHistoriesReached:20,ownerWalletsResolved:20});
 assert.deepEqual(r.components.map(x=>x.max),[40,10,20,20,10]);
 assert.equal(r.possible,100);
 assert.equal(r.score,r.earned);
 assert.equal(r.historyComplete,false);
 assert.equal(r.components[1].score,9);
 assert.equal(r.components[4].score,6);
});
test("missing historical evidence is not scored as zero connections",()=>{
 const r=scoreHolderConcentration({top20SharePct:30,largestAccountSharePct:6,ownerWalletsResolved:20});
 assert.equal(r.components[1].score,null);
 assert.equal(r.components[2].score,null);
 assert.equal(r.score,null);
 assert.equal(r.possible,70);
});
test("extreme concentration earns fewer points than diversified holdings",()=>{
 const low=scoreHolderConcentration({top20SharePct:15,largestAccountSharePct:2,ownerWalletsResolved:20});
 const high=scoreHolderConcentration({top20SharePct:80,largestAccountSharePct:30,ownerWalletsResolved:20});
 assert.ok(low.earned>high.earned);
});
