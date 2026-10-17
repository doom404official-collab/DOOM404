import test from "node:test";
import assert from "node:assert/strict";
import {scoreHolderIntelligence} from "../lib/glitchAttributeEnginesV11.mjs";
test("unknown classification does not earn independence points",()=>{
 const r=scoreHolderIntelligence({top20SharePct:25,independencePoints:10,historyComplete:true,classificationComplete:false});
 assert.equal(r.components.find(c=>c.id==="holder_breadth_independence").points,null);
 assert.equal(r.score,null);
});
test("verified classification still requires history coverage",()=>{
 const r=scoreHolderIntelligence({independencePoints:10,classificationComplete:true,historyComplete:false});
 assert.equal(r.components.find(c=>c.id==="holder_breadth_independence").points,null);
});
