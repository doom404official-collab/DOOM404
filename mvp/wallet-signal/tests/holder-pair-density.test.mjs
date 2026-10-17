import test from "node:test";
import assert from "node:assert/strict";
import {scoreHolderIntelligence} from "../lib/glitchAttributeEnginesV11.mjs";
test("v1.1 network has 35 points, not legacy 10-point density",()=>{
 const r=scoreHolderIntelligence({top20SharePct:30,networkScore:13.79,historyComplete:true});
 assert.equal(r.components.find(c=>c.id==="connected_wallet_network").max,35);
 assert.equal(r.components.find(c=>c.id==="connected_wallet_network").points,13.79);
 assert.equal(r.score,null);
});
test("network points withheld until historical coverage complete",()=>{
 const r=scoreHolderIntelligence({top20SharePct:30,networkScore:35,historyComplete:false});
 assert.equal(r.components[1].points,null);
});
