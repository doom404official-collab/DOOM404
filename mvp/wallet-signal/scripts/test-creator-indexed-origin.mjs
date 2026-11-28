import assert from 'node:assert/strict';
import {investigateIndexedCreatorOrigin} from '../lib/creatorIndexedOriginInvestigation.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const first='1'.repeat(88),second='2'.repeat(88);
const calls=[];
const result=await investigateIndexedCreatorOrigin({mint,candidates:[{signature:second,slot:200},{signature:first,slot:100}],rpc:{
 fetchTransaction:async signature=>{calls.push(signature);return null;}
}});
assert.deepEqual(calls,[first,second]);
assert.deepEqual(result.deferred,[first,second]);
assert.deepEqual(result.proofs,[]);
assert.equal(result.historyComplete,false);
console.log('creator indexed origin investigation tests passed');
