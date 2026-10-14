import test from "node:test";
import assert from "node:assert/strict";
import {scoreHolderConcentration} from "../lib/holderConcentrationScore.mjs";

test("eight direct pairs among twenty owners yields 7.89 of ten",()=>{
 const r=scoreHolderConcentration({top20SharePct:31.38,largestAccountSharePct:5.84,
  ownerWalletsResolved:20,directPairs:8,
  connectedGroups:[{combinedObservedSharePct:15.3547}]});
 assert.equal(r.possiblePairs,190);
 assert.equal(r.observedDirectPairs,8);
 assert.equal(r.connectionDensityPct,4.21);
 assert.equal(r.components.find(x=>x.id==="connections").score,7.89);
 assert.equal(r.score,r.earned);
});
test("observed direct-pair density reduces score monotonically",()=>{
 const score=pairs=>scoreHolderConcentration({top20SharePct:30,largestAccountSharePct:6,
  ownerWalletsResolved:20,directPairs:pairs}).components[1].score;
 assert.ok(score(0)>score(8));
 assert.ok(score(8)>score(38));
 assert.equal(score(38),0);
});
