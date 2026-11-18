import assert from 'node:assert/strict';
import {runCreatorIntelligenceTick} from '../tests/helpers/creatorTickMockLease.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
let state={originEvidence:[{creator,signature:'1'.repeat(88)}],creatorHistoryRpcExhausted:true,
 creatorPendingSignatures:['2'.repeat(88)]};
const store={async get(){return {stage:'selling',status:'partial',state}},async claim(){return true},
 async save(v){state=v.state}};
const fetchImpl=async()=>({ok:true,status:200,json:async()=>({result:[]})});
for(let i=0;i<2;i++){
 await runCreatorIntelligenceTick({mint,store,rpcUrl:'https://example.com',fetchImpl});
 assert.equal(state.creatorHistoricalCoverage.historyComplete,false);
 assert.equal(state.creatorHistoricalCoverage.archiveVerified,false);
 assert.equal(state.creatorHistoryComplete,false);
}
console.log('creator historical coverage two-run checkpoint tests passed');
