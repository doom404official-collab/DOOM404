import test from "node:test";
import assert from "node:assert/strict";
import {createHolderHistoryCheckpoint,recordHistoryPage,recordDecodedTransaction} from "../lib/holderHistoryCheckpoint.mjs";
import {publicHolderScanView} from "../lib/publicHolderScanView.mjs";
import {scoreHolderConcentration} from "../lib/holderConcentrationScore.mjs";

test("persisted transfer evidence produces connection graph and weighted score",()=>{
 const holders=Array.from({length:20},(_,i)=>({
  ownerWallet:"wallet"+i,tokenAccount:"account"+i,sharePct:i===0?6:1
 }));
 const cp=createHolderHistoryCheckpoint({mint:"test-mint",holders});
 recordHistoryPage(cp,{wallet:"wallet0",page:{
  wallet:"wallet0",signatures:["sig1"],nextCursor:"sig1",
  entriesSeen:1,providerPageExhausted:false
 }});
 recordDecodedTransaction(cp,{signature:"sig1",transfers:[{
  confirmed:true,directInteraction:true,participants:["wallet0","wallet1"]
 }]});
 const view=publicHolderScanView(cp);
 assert.equal(view.directPairs,1);
 assert.equal(view.connectedWallets,2);
 assert.equal(view.connectedGroups[0].combinedObservedSharePct,7);
 const score=scoreHolderConcentration({
  top20SharePct:25,largestAccountSharePct:6,
  connectedGroups:view.connectedGroups,connectedWallets:view.connectedWallets,
  directPairs:view.directPairs,walletHistoriesReached:view.walletHistoriesReached,
  ownerWalletsResolved:view.ownerWalletsResolved
 });
 assert.equal(score.components.find(c=>c.id==="connections").score,9.74);
 assert.equal(score.components.find(c=>c.id==="combined").score,18.67);
 assert.equal(score.possible,100);
 assert.equal(score.historyComplete,false);
});
