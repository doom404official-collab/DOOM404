import test from "node:test";
import assert from "node:assert/strict";
import {summarizeHistoricalHolderPreview} from "../lib/holderHistoricalPreviewV11.mjs";
test("missing historical scan is unavailable",()=>{
 const r=summarizeHistoricalHolderPreview({});
 assert.equal(r.available,false);assert.equal(r.historyComplete,false);
});
test("observed historical connections remain visible without declaring history complete",()=>{
 const r=summarizeHistoricalHolderPreview({historical:{holders:[{ownerWallet:"A"},{ownerWallet:"B"}],directPairs:1,connectedWallets:2,historyComplete:false},compatible:false});
 assert.equal(r.available,true);assert.equal(r.directPairs,1);assert.equal(r.connectedWallets,2);
 assert.equal(r.compatible,false);assert.equal(r.historyComplete,false);
 assert.match(r.note,/differs/);
});
test("matching snapshot still does not imply historical exhaustion",()=>{
 const r=summarizeHistoricalHolderPreview({historical:{holders:[],directPairs:0,connectedWallets:0},compatible:true});
 assert.equal(r.compatible,true);assert.equal(r.historyComplete,false);
});
