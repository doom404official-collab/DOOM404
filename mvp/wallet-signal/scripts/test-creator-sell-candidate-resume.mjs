import assert from 'node:assert/strict';
import {runCreatorIntelligenceTick} from '../lib/creatorIntelligenceTick.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
let state={originEvidence:[{creator,signature:'1'.repeat(88)}],creatorSellCandidates:[
 {signature:'2'.repeat(88),status:'HISTORICAL_SETTLEMENT_REVIEW_PENDING',saleVerified:false}]};
const store={async get(){return {status:'partial',stage:'selling',state}},async claim(){return true},async save(v){state=v.state}};
const fetchImpl=async()=>({ok:true,status:200,json:async()=>({result:[]})});
for(let run=0;run<2;run++){
 await runCreatorIntelligenceTick({mint,store,rpcUrl:'https://example.com',fetchImpl});
 assert.equal(state.creatorSellCandidates.length,1);
 assert.equal(state.creatorSellCandidates[0].signature,'2'.repeat(88));
 assert.equal(state.creatorSellCandidates[0].saleVerified,false);
}
console.log('creator selling two-run checkpoint persistence tests passed');
