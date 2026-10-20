import assert from 'node:assert/strict';
import {prioritizeCreatorOriginCandidates} from '../lib/creatorOriginCandidatePriority.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const a='1'.repeat(88),b='2'.repeat(88),c='3'.repeat(88);
const result=prioritizeCreatorOriginCandidates({mint,candidates:[
 {signature:a,slot:300},{signature:b,slot:100},{signature:a,slot:300},
 {signature:c,slot:200,mint:'different'}
]});
assert.deepEqual(result.map(x=>x.signature),[b,a]);
assert.ok(result.every(x=>x.status==='UNVERIFIED_CANDIDATE'));
console.log('creator origin candidate priority tests passed');
