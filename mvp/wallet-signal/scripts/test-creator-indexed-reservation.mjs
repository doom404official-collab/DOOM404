import assert from 'node:assert/strict';
import {runCreatorIntelligenceTick} from '../lib/creatorIntelligenceTick.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
let state={},providerCalls=0,saveCalls=0;
const store={
 async get(){return {status:'partial',stage:'identification',state}},
 async claim(){return true},
 async save(v){saveCalls++;state=v.state;return true}
};
const fetchImpl=async(_url,options)=>{
 const {method}=JSON.parse(options.body);
 if(method==='getTransactionsForAddress'){
  providerCalls++;
  assert.equal(state.indexedOriginLookupAttempted,true,'reservation must exist before paid request');
  assert.equal(state.indexedOriginProviderStatus,'RESERVED');
  throw Error('SIMULATED_PROVIDER_NETWORK_FAILURE');
 }
 return {ok:true,status:200,json:async()=>({result:[]})};
};
await runCreatorIntelligenceTick({mint,store,rpcUrl:'https://example.com',fetchImpl,indexedOriginEnabled:true});
assert.equal(providerCalls,1);
assert.equal(state.indexedOriginLookupAttempted,true);
assert.equal(state.indexedOriginProviderStatus,'LOOKUP_FAILED');
assert.ok(saveCalls>=2);
await runCreatorIntelligenceTick({mint,store,rpcUrl:'https://example.com',fetchImpl,indexedOriginEnabled:true});
assert.equal(providerCalls,1,'do not repeat paid request after failed lookup');
console.log('creator indexed lookup reservation tests passed');
