import assert from 'node:assert/strict';
import {runCreatorIntelligenceTick} from '../lib/creatorIntelligenceTick.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const signature='1'.repeat(88);
let saved;
const state={indexedOriginCandidates:[{signature,slot:100}]};
const store={async get(){return {status:'partial',stage:'identification',state}},async claim(){return true},async save(v){saved=v}};
const fetchImpl=async(_url,options)=>{
 const {method}=JSON.parse(options.body);
 return {ok:true,status:200,json:async()=>({result:method==='getTransaction'?null:[]})};
};
const result=await runCreatorIntelligenceTick({mint,store,rpcUrl:'https://example.com',fetchImpl});
assert.equal(result.status,'partial');
assert.deepEqual(saved.state.indexedOriginDeferred,[signature]);
assert.deepEqual(saved.state.indexedOriginChecked,[]);
assert.equal(saved.state.originEvidence.length,0);
assert.equal(saved.state.historyComplete,false);
console.log('creator indexed tick tests passed');
