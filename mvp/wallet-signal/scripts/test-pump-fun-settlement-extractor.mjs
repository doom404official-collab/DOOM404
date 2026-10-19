import assert from 'node:assert/strict';
import {extractPumpFunSettlementEvidence} from '../lib/pumpFunSettlementEvidenceExtractor.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
const result=extractPumpFunSettlementEvidence({mint,creator,signature:'1'.repeat(88),
 transaction:{meta:{err:null,preTokenBalances:[],postTokenBalances:[]},transaction:{message:{accountKeys:[],instructions:[]}}}});
assert.equal(result,null);
console.log('Pump.fun settlement evidence extractor tests passed');
