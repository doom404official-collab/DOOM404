import assert from 'node:assert/strict';
import {runCreatorIntelligenceTick} from '../lib/creatorIntelligenceTick.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
let state={originEvidence:[{creator,signature:'1'.repeat(88)}],creatorHistorySignatures:['2'.repeat(88)]};
const store={async get(){return {stage:'selling',status:'partial',state}},async claim(){return true},async save(v){state=v.state}};
const fetchImpl=async(_url,options)=>{
 const {method}=JSON.parse(options.body);
 return {ok:true,status:200,json:async()=>({result:method==='getTransaction'?{
 blockTime:1700000000,transaction:{message:{accountKeys:[],instructions:[]}},
 meta:{err:null,preTokenBalances:[],postTokenBalances:[]}}:[]})};
};
for(let i=0;i<2;i++){
 await runCreatorIntelligenceTick({mint,store,rpcUrl:'https://example.com',fetchImpl});
 assert.equal(state.creatorBuyShadowResults.length,0);
 assert.equal(state.creatorVerifiedAcquisitionEvents.length,0);
 assert.equal(state.creatorAcquisitionLedger.scoreEligible,false);
}
console.log('creator buy shadow checkpoint tests passed');
