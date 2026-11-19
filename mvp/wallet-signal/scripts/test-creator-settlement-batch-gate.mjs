import assert from 'node:assert/strict';
import {inspectCreatorHistoricalBatch} from '../lib/creatorHistoricalTransactionBatch.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
const signature='1'.repeat(88);
const transaction={blockTime:1700000000,meta:{err:null,preTokenBalances:[],postTokenBalances:[]},
 transaction:{message:{accountKeys:[],instructions:[]}}};
const rpc={fetchTransaction:async()=>transaction};
let invoked=0;
const result=await inspectCreatorHistoricalBatch({mint,creator,signatures:[signature],rpc,
 settlementDecoder:async()=>{invoked++;return {independentlyDecoded:true};}});
assert.equal(result.verifiedSales.length,0);
assert.equal(result.sellCandidates.length,0);
assert.equal(invoked,0,'decoder must not be invoked without corroborated transaction evidence');
console.log('creator settlement batch evidence gating tests passed');
