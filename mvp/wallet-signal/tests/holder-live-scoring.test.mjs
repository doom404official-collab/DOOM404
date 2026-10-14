import test from "node:test";
import assert from "node:assert/strict";
import {scoreHolderConcentration} from "../lib/holderConcentrationScore.mjs";
test("live top-20 concentration produces numerical 40-point component",()=>{
 const score=scoreHolderConcentration({top20SharePct:31.38,largestAccountSharePct:5.84,ownerWalletsResolved:20});
 assert.equal(score.components[0].score,27);
 assert.equal(score.components[0].max,40);
 assert.equal(score.components[1].score,null);
 assert.equal(score.components[2].score,null);
 assert.equal(score.score,null);
});
test("stored connected group is scored when historical investigation exists",()=>{
 const score=scoreHolderConcentration({top20SharePct:31.38,largestAccountSharePct:5.84,ownerWalletsResolved:20,
  walletHistoriesReached:20,connectedWallets:7,directPairs:8,
  connectedGroups:[{combinedObservedSharePct:15.3547}]});
 assert.equal(score.possible,100);
 assert.equal(score.components[1].score,9);
 assert.equal(score.components[2].score,13);
 assert.equal(score.score,score.earned);
});
