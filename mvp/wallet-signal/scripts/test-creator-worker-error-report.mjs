import assert from 'node:assert/strict';
import {runCreatorIntelligenceTick} from '../lib/creatorIntelligenceTick.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
let saved;
const store={
 async get(){return {status:'partial',stage:'identification',state:{}}},
 async claim(){return true},
 async save(v){saved=v}
};
const fetchImpl=async()=>{throw Error('SIMULATED_RPC_FAILURE')};
const result=await runCreatorIntelligenceTick({mint,store,rpcUrl:'https://example.com',fetchImpl,maxRequests:5});
assert.equal(result.status,'partial');
assert.equal(result.errorCode,'CREATOR_TICK_ERROR');
assert.equal(saved.state.lastError,'CREATOR_TICK_ERROR');
assert.ok(saved.requestCount>0);
console.log('creator error reporting tests passed');
