import test from "node:test";
import assert from "node:assert/strict";
import {createHolderHistoryCheckpoint,recordHistoryPage,recordDecodedTransaction} from "../lib/holderHistoryCheckpoint.mjs";
import {publicHolderScanView} from "../lib/publicHolderScanView.mjs";
const holders=Array.from({length:20},(_,i)=>({ownerWallet:"wallet"+i,tokenAccount:"account"+i,sharePct:1}));
test("public view shows linked holders without leaking checkpoint internals",()=>{
 const cp=createHolderHistoryCheckpoint({mint:"mint",holders});
 recordHistoryPage(cp,{wallet:"wallet0",page:{wallet:"wallet0",signatures:["sig"],entriesSeen:1,nextCursor:"sig",providerPageExhausted:false}});
 recordDecodedTransaction(cp,{signature:"sig",transfers:[{confirmed:true,directInteraction:true,participants:["wallet0","wallet1"]}]});
 const view=publicHolderScanView(cp);
 assert.equal(view.top20SharePct,20);
 assert.equal(view.directPairs,1);
 assert.equal(view.connectedWallets,2);
 assert.equal(view.walletHistoriesReached,1);
 assert.equal(view.historyComplete,false);
 assert.equal(Object.hasOwn(view,"signatures"),false);
 assert.equal(Object.hasOwn(view,"failedSignatures"),false);
});
