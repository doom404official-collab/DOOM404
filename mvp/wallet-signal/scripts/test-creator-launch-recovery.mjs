import assert from 'node:assert/strict';
import {runCreatorIntelligenceTick} from '../tests/helpers/creatorTickMockLease.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
const signature='1'.repeat(88);
let state={originEvidence:[{creator,signature}],originRecheck:{rechecked:true,signature}};
const store={async get(){return {stage:'selling',status:'partial',state}},async claim(){return true},async save(v){state=v.state}};
const fetchImpl=async(_url,options)=>{
 const {method}=JSON.parse(options.body);
 return {ok:true,status:200,json:async()=>({result:method==='getTransaction'?{
  blockTime:1700000000,meta:{err:null,preTokenBalances:[],postTokenBalances:[]},
  transaction:{message:{accountKeys:[],instructions:[]}}}:[]})};
};
await runCreatorIntelligenceTick({mint,store,rpcUrl:'https://example.com',fetchImpl});
assert.equal(state.launchTimestamp,1700000000);
assert.equal(state.launchTimeEvidence.status,'CREATION_TIMESTAMP_VERIFIED');
assert.equal(state.initialAllocationEvidence.initialAttributableRaw,null);
console.log('creator selling launch time checkpoint recovery tests passed');
