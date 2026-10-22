import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {storePreparedEvidence} from '../lib/creatorHistoricalPrivateRetention.mjs';
const prepared=()=>{const payload=Buffer.from('synthetic offline only');return {status:'READY_FOR_RESTRICTED_REVIEW',payload,objectKey:'global/synthetic/test.json',payloadSha256:createHash('sha256').update(payload).digest('hex')};};
test('positive mocked upload and readback',async()=>{const e=prepared();let calls=0;const r=await storePreparedEvidence(e,{upload:async(key,bytes,options)=>{calls++;assert.equal(options.overwrite,false);assert.equal(key,e.objectKey);assert.deepEqual(bytes,e.payload);return true;},read:async()=>{calls++;return Buffer.from(e.payload);}});assert.equal(r.status,'READBACK_VERIFIED');assert.equal(r.eligibleForLivePromotion,false);assert.equal(calls,2);});
test('upload rejection prevents readback',async()=>{let reads=0;const r=await storePreparedEvidence(prepared(),{upload:async()=>false,read:async()=>{reads++;return Buffer.alloc(0);}});assert.equal(r.reason,'UPLOAD_NOT_CONFIRMED');assert.equal(reads,0);});
test('tampered readback rejected',async()=>{const r=await storePreparedEvidence(prepared(),{upload:async()=>true,read:async()=>Buffer.from('tampered')});assert.equal(r.reason,'READBACK_MISMATCH');});
test('tampered prepared payload rejected before transport',async()=>{const e=prepared();e.payload[0]^=1;let calls=0;const r=await storePreparedEvidence(e,{upload:async()=>{calls++;return true;},read:async()=>{calls++;return Buffer.alloc(0);}});assert.equal(r.reason,'PREPARED_EVIDENCE_INVALID');assert.equal(calls,0);});
