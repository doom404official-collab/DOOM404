import assert from 'node:assert/strict';
import {runCreatorIntelligenceTick} from '../lib/creatorIntelligenceTick.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
let state={},calls=0,saved;
const store={async get(){return {status:'partial',stage:'identification',state}},async claim(){return true},async save(v){saved=v;state=v.state}};
const fetchImpl=async(_url,options)=>{
 const {method}=JSON.parse(options.body);
 if(method==='getTransactionsForAddress'){calls++;return {ok:true,status:200,json:async()=>({result:{data:[]}})};}
 return {ok:true,status:200,json:async()=>({result:[]})};
};
await runCreatorIntelligenceTick({mint,store,rpcUrl:'https://example.com',fetchImpl,indexedOriginEnabled:true});
assert.equal(calls,1);
assert.equal(saved.state.indexedOriginLookupAttempted,true);
assert.equal(saved.state.indexedOriginProviderStatus,'CANDIDATES');
await runCreatorIntelligenceTick({mint,store,rpcUrl:'https://example.com',fetchImpl,indexedOriginEnabled:true});
assert.equal(calls,1,'paid indexed lookup must not repeat on next tick');
console.log('creator one-time indexed origin lookup tests passed');
