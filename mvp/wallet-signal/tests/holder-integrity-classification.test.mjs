import test from "node:test";
import assert from "node:assert/strict";
import {scoreHolderConcentration} from "../lib/holderConcentrationScore.mjs";
test("unclassified token account owners earn at most six integrity points",()=>{
 const result=scoreHolderConcentration({ownerWalletsResolved:20});
 assert.equal(result.components.find(c=>c.id==="integrity").score,6);
 assert.equal(result.possible,40);\n assert.equal(result.score,null); // Live concentration inputs are required for a meaningful total.
});
test("verified custody classification earns remaining four points",()=>{
 const result=scoreHolderConcentration({ownerWalletsResolved:20,custodyClassificationComplete:true});
 assert.equal(result.components.find(c=>c.id==="integrity").score,10);
 assert.equal(result.classificationComplete,true);
});
