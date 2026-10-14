import test from "node:test";
import assert from "node:assert/strict";
import {nextHolderScanOrder,advanceHolderScanCursor,holderScanCoverage} from "../lib/holderRoundRobin.mjs";
const cp=()=>({wallets:{A:{pages:2,signaturesSeen:20,exhausted:false},B:{pages:0,signaturesSeen:0,exhausted:false},C:{pages:1,signaturesSeen:4,exhausted:true}},nextWalletIndex:1});
test("resume starts with next wallet and skips exhausted wallets",()=>{
 assert.deepEqual(nextHolderScanOrder(cp()),["B","A"]);
});
test("cursor advances to next wallet persistently",()=>{
 const x=cp();advanceHolderScanCursor(x,"B");
 assert.equal(x.nextWalletIndex,2);
 assert.deepEqual(nextHolderScanOrder(x),["A","B"]);
});
test("coverage reports every wallet without implying archive completeness",()=>{
 const x=holderScanCoverage(cp());
 assert.equal(x.walletsWithPages,2);
 assert.equal(x.walletsProviderExhausted,1);
 assert.equal(x.archivalCompletenessProven,false);
});
