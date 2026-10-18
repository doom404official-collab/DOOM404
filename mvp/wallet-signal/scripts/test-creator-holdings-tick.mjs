import assert from 'node:assert/strict';
import {runCreatorIntelligenceTick} from '../lib/creatorIntelligenceTick.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
const signature='1'.repeat(88);
let saved;
const store={
 async get(){return {status:'partial',stage:'holdings',state:{originEvidence:[{creator,signature}]}},
 async claim(){return true},
 async save(value){saved=value;return true}
};
const fetchImpl=async(_url,options)=>{
 const {method}=JSON.parse(options.body);
 const result=method==='getTokenSupply'?{value:{amount:'1000000',decimals:2}}:
 method==='getTokenAccountsByOwner'?{value:[{pubkey:mint,account:{data:{parsed:{type:'account',info:{mint,owner:creator,tokenAmount:{amount:'20000'}}}}}}]}:
 null;
 return {ok:true,status:200,json:async()=>({result})};
};
const outcome=await runCreatorIntelligenceTick({mint,store,rpcUrl:'https://example.com',fetchImpl});
assert.equal(outcome.stage,'holdings');
assert.equal(saved.stage,'holdings');
assert.equal(saved.requestCount,1);
assert.equal(saved.state.originRecheck.rechecked,false);
assert.equal(saved.state.identificationStatus,'ONCHAIN_MATCH_PENDING_INDEPENDENT_REVIEW');
assert.equal(saved.state.holdings,undefined);
console.log('creator holdings tick evidence gate tests passed');
