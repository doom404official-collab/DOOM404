import test from 'node:test';
import assert from 'node:assert/strict';
import {decidePublicDeepScan} from './publicDeepScanAdmission.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
test('public deep scan defaults disabled',()=>assert.equal(decidePublicDeepScan({mint}).status,503));
test('invalid mint is rejected',()=>assert.equal(decidePublicDeepScan({mint:'invalid'}).status,400));
test('active job is reused rather than duplicated',()=>{
 const r=decidePublicDeepScan({mint,activeJob:{id:'existing',status:'running'}});
 assert.equal(r.reason,'existing_job');assert.equal(r.jobId,'existing');
});
test('authentication and quota required before admission',()=>{
 assert.equal(decidePublicDeepScan({mint,featureEnabled:true}).status,401);
 assert.equal(decidePublicDeepScan({mint,featureEnabled:true,authenticated:true}).status,429);
 assert.equal(decidePublicDeepScan({mint,featureEnabled:true,authenticated:true,quotaGranted:true}).allowed,true);
});
