import assert from 'node:assert/strict';
import {inspectCreatorHistoricalBatch} from '../lib/creatorHistoricalTransactionBatch.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
const signature='1'.repeat(88);
const transaction={transaction:{message:{accountKeys:[],instructions:[]}},
 meta:{err:null,preTokenBalances:[],postTokenBalances:[]}};
let calls=0;
const result=await inspectCreatorHistoricalBatch({mint,creator,signatures:[signature],
 rpc:{fetchTransaction:async()=>transaction},buySettlementDecoder:async()=>{calls++;return {
 signature,creator,mint,independentlyVerified:true,settlementVerified:true,protocolVerified:true};}});
assert.equal(calls,1);
assert.equal(result.verifiedAcquisitionEvents.length,0);
console.log('creator verified acquisition batch integration tests passed');
