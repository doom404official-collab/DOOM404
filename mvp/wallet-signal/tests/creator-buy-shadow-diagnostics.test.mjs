import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectPumpFunBuyShadow} from '../lib/pumpFunBuyShadowValidation.mjs';
import {inspectCreatorHistoricalBatch} from '../lib/creatorHistoricalTransactionBatch.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const creator='11111111111111111111111111111111';
// Valid deterministic Base58 fixture; the batch validates signatures before diagnostics.
const signature='2'.repeat(88);
const transaction={blockTime:1,meta:{err:null,innerInstructions:[]},transaction:{message:{accountKeys:[],instructions:[]}}};
test('shadow no-buy case returns diagnostic without purchase promotion',()=>{
 const result=inspectPumpFunBuyShadow({mint,creator,signature,transaction});
 assert.equal(result.status,'NO_VERIFIED_BUY_EVIDENCE');
 assert.equal(result.diagnostic,'NO_PUMP_FUN_BUY_INSTRUCTION');
 assert.equal(result.purchaseVerified,false);
});
test('historical batch counts excluded no-evidence shadow results',async()=>{
 const rpc={fetchTransaction:async()=>transaction};
 const result=await inspectCreatorHistoricalBatch({mint,creator,signatures:[signature],rpc,maxTransactions:1});
 assert.deepEqual(result.processed,[signature]);
 assert.deepEqual(result.pending,[]);
 assert.equal(result.buyShadowResults.length,0);
 assert.equal(result.buyShadowStatusCounts.NO_VERIFIED_BUY_EVIDENCE,1);
 assert.equal(result.buyShadowDiagnosticCounts.NO_PUMP_FUN_BUY_INSTRUCTION,1);
 assert.equal(result.verifiedAcquisitionEvents.length,0);
});

test('unrecognized Pump.fun instruction with indexed program ID is diagnosed without promotion',()=>{
 const tx={...transaction,transaction:{message:{accountKeys:['6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P'],instructions:[{programIdIndex:0,data:'2'}]}}};
 const result=inspectPumpFunBuyShadow({mint,creator,signature,transaction:tx});
 assert.equal(result.status,'NO_VERIFIED_BUY_EVIDENCE');
 assert.equal(result.diagnostic,'PUMP_FUN_INSTRUCTION_UNRECOGNIZED');
 assert.equal(result.purchaseVerified,false);
});

test('explicit Pump.fun instruction with unrecognized payload stays diagnostic only',()=>{
 const tx={...transaction,transaction:{message:{accountKeys:[],instructions:[{programId:'6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',data:'2'}]}}};
 const result=inspectPumpFunBuyShadow({mint,creator,signature,transaction:tx});
 assert.equal(result.status,'NO_VERIFIED_BUY_EVIDENCE');
 assert.equal(result.diagnostic,'PUMP_FUN_INSTRUCTION_UNRECOGNIZED');
 assert.equal(result.purchaseVerified,false);
});

test('non-promotable Token-2022 shadow evidence cannot enter historical acquisition ledger',async()=>{
 const nonPromotable={status:'EVIDENCE_OBSERVED_UNVERIFIED',eligibleForLivePromotion:false,settlementVerified:false,independentlyVerified:false};
 const result=await inspectCreatorHistoricalBatch({
  mint,creator,signatures:[signature],maxTransactions:1,
  rpc:{fetchTransaction:async()=>transaction},
  buySettlementDecoder:async()=>nonPromotable
 });
 assert.deepEqual(result.processed,[signature]);
 assert.deepEqual(result.verifiedAcquisitionEvents,[]);
});
