import assert from 'node:assert/strict';
import {runCreatorIntelligenceTick} from '../tests/helpers/creatorTickMockLease.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
let state={originEvidence:[{creator,signature:'1'.repeat(88)}],creatorVerifiedAcquisitionEvents:[]};
const store={async get(){return {stage:'selling',status:'partial',state}},async claim(){return true},async save(v){state=v.state}};
const fetchImpl=async()=>({ok:true,status:200,json:async()=>({result:[]})});
for(let i=0;i<2;i++){
 await runCreatorIntelligenceTick({mint,store,rpcUrl:'https://example.com',fetchImpl});
 assert.equal(state.creatorAcquisitionLedger.status,'INCOMPLETE');
 assert.equal(state.creatorAcquisitionLedger.scoreEligible,false);
 assert.equal(state.creatorAcquisitionLedger.sellThroughPct,null);
}
console.log('creator acquisition ledger checkpoint tests passed');
