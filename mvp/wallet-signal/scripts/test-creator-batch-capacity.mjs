import assert from 'node:assert/strict';
import {runCreatorIntelligenceTick} from '../lib/creatorIntelligenceTick.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
const signatures=Array.from({length:70},(_,i)=>String(i+1).padStart(88,'1'));
let state={originEvidence:[{creator,signature:'1'.repeat(88)}],creatorHistorySignatures:signatures};
const store={async get(){return {stage:'selling',status:'partial',state}},async claim(){return true},async save(v){state=v.state}};
const fetchImpl=async(_url,options)=>{
 const {method}=JSON.parse(options.body);
 return {ok:true,status:200,json:async()=>({result:method==='getTransaction'?
 {blockTime:1700000000,meta:{err:null,preTokenBalances:[],postTokenBalances:[]},
 transaction:{message:{accountKeys:[],instructions:[]}}}:[]})};
};
await runCreatorIntelligenceTick({mint,store,rpcUrl:'https://example.com',fetchImpl,creatorBatchSize:60});
assert.equal(state.creatorProcessedSignatures.length,60);
assert.equal(state.creatorHistoryComplete,false);
assert.equal(state.verifiedSwapSales.length,0);
console.log('creator bounded selling batch capacity tests passed');
