import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectPumpFunBuyShadow} from '../lib/pumpFunBuyShadowValidation.mjs';
import {inspectCreatorHistoricalBatch} from '../lib/creatorHistoricalTransactionBatch.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const creator='11111111111111111111111111111111';
const transaction={blockTime:1,meta:{err:null,innerInstructions:[]},transaction:{message:{accountKeys:[],instructions:[]}}};
test('shadow no-buy case returns diagnostic without purchase promotion',()=>{
 const result=inspectPumpFunBuyShadow({mint,creator,signature:'sig',transaction});
 assert.equal(result.status,'NO_VERIFIED_BUY_EVIDENCE');
 assert.equal(result.diagnostic,'NO_PUMP_FUN_BUY_INSTRUCTION');
 assert.equal(result.purchaseVerified,false);
});
test('historical batch counts excluded no-evidence shadow results',async()=>{
 const rpc={fetchTransaction:async()=>transaction};
 const result=await inspectCreatorHistoricalBatch({mint,creator,signatures:['sig'],rpc,maxTransactions:1});
 assert.equal(result.buyShadowResults.length,0);
 assert.equal(result.buyShadowStatusCounts.NO_VERIFIED_BUY_EVIDENCE,1);
 assert.equal(result.buyShadowDiagnosticCounts.NO_PUMP_FUN_BUY_INSTRUCTION,1);
 assert.equal(result.verifiedAcquisitionEvents.length,0);
});
