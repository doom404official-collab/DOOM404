import assert from 'node:assert/strict';
import {extractCreatorLaunchTime} from '../lib/creatorLaunchTimeEvidence.mjs';
const signature='1'.repeat(88);
const verified=extractCreatorLaunchTime({transaction:{blockTime:1700000000,meta:{err:null}},creationSignature:signature,verifiedSignature:signature});
assert.equal(verified.launchTimestamp,1700000000);
assert.equal(verified.initialAttributableRaw,null);
const mismatch=extractCreatorLaunchTime({transaction:{blockTime:1700000000,meta:{err:null}},creationSignature:signature,verifiedSignature:'2'.repeat(88)});
assert.equal(mismatch.launchTimestamp,null);
console.log('creator launch time evidence tests passed');
