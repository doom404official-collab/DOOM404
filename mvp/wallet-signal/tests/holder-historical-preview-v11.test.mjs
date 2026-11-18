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
test("missing and malformed observed counts remain Pending inputs rather than numerical zero",()=>{
 for(const value of [undefined,null,false,true,"","0","2",-1,0.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]){
  const r=summarizeHistoricalHolderPreview({historical:{holders:[],directPairs:value,connectedWallets:value}});
  assert.equal(r.directPairs,null,`directPairs must withhold ${String(value)}`);
  assert.equal(r.connectedWallets,null,`connectedWallets must withhold ${String(value)}`);
  assert.equal(r.historyComplete,false);
 }
});
test("numeric count representation preserves zero and safe whole counts independently",()=>{
 for(const value of [0,1,42,Number.MAX_SAFE_INTEGER]){
  const r=summarizeHistoricalHolderPreview({historical:{holders:[],directPairs:value,connectedWallets:null}});
  assert.equal(r.directPairs,value);
  assert.equal(r.connectedWallets,null);
  assert.equal(r.historyComplete,false);
 }
});
