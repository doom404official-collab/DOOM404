import test from 'node:test';
import assert from 'node:assert/strict';
import {storeHistoricalGlobal} from '../lib/creatorHistoricalPrivateRetention.mjs';

test('missing capture fails before transport',async()=>{
 let calls=0;
 const transport={upload:async()=>{calls++;return true;},read:async()=>{calls++;return Buffer.alloc(0);}};
 const result=await storeHistoricalGlobal({},transport);
 assert.equal(result.status,'REJECTED');
 assert.equal(result.reason,'CAPTURE_PROVENANCE_MISMATCH');
 assert.equal(calls,0);
});
test('incorrect historical evidence fails before transport',async()=>{
 let calls=0;
 const slot=442809233;
 const capture={capture:{accountAddress:'4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf',requestedSlot:slot,method:'getAccountInfo'},result:{context:{slot},value:{owner:'6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',data:[Buffer.alloc(1045).toString('base64'),'base64']}}};
 const result=await storeHistoricalGlobal(capture,{upload:async()=>{calls++;return true;},read:async()=>{calls++;return Buffer.alloc(0);}});
 assert.equal(result.reason,'ACCOUNT_EVIDENCE_MISMATCH');
 assert.equal(calls,0);
});
test('no transport never succeeds',async()=>{
 const result=await storeHistoricalGlobal(null);
 assert.equal(result.status,'REJECTED');
 assert.equal(result.eligibleForLivePromotion,undefined);
});
