import assert from 'node:assert/strict';
import {runCreatorIntelligenceTick} from '../lib/creatorIntelligenceTick.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const sig='1'.repeat(88);
let state={nextCursor:null},status='queued',stage='identification',saved=null;
const store={
 async get(){return {status,stage,state}},
 async claim(){state={...state,claimObserved:true};return true},
 async save(v){saved=v;state=v.state;status=v.status;stage=v.stage;return true}
};
const fetchImpl=async(_url,options)=>{
 const {method}=JSON.parse(options.body);
 if(method==='getSignaturesForAddress')return {ok:true,status:200,json:async()=>({result:[{signature:sig,err:null}]})};
 if(method==='getTransaction')return {ok:true,status:200,json:async()=>({result:null})};
 throw Error('UNEXPECTED_RPC');
};
const first=await runCreatorIntelligenceTick({mint,store,rpcUrl:'https://example.com',fetchImpl,maxRequests:500});
assert.equal(first.status,'partial');
assert.equal(first.requests,2);
assert.equal(saved.requestCount,2);
assert.deepEqual(saved.state.deferredSignatures,[sig]);
assert.equal(saved.state.historyComplete,false);
assert.equal(saved.state.claimObserved,true,'tick must reload checkpoint after lease claim');
assert.equal(saved.state.identificationStatus,'UNRESOLVED_ARCHIVE_NOT_PROVEN');
assert.equal(saved.stage,'identification');
console.log('creator intelligence tick tests passed');
