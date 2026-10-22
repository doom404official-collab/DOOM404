import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {storePreparedEvidence} from '../lib/creatorHistoricalPrivateRetention.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
function prepared(){const payload=Buffer.from('original');return {status:'READY_FOR_RESTRICTED_REVIEW',payload,objectKey:'global/synthetic/original.json',payloadSha256:hash(payload)};}
test('upload cannot replace accepted payload and digest with mutated evidence',async()=>{
 const evidence=prepared();let readKey;
 const result=await storePreparedEvidence(evidence,{upload:async(key,bytes)=>{bytes.write('modified');evidence.payload=bytes;evidence.payloadSha256=hash(bytes);evidence.objectKey='global/synthetic/modified.json';return true;},read:async key=>{readKey=key;return Buffer.from(evidence.payload);}});
 assert.equal(readKey,'global/synthetic/original.json');assert.equal(result.status,'REJECTED');assert.equal(result.reason,'READBACK_MISMATCH');
});
test('caller mutation while upload awaits cannot alter verified identity',async()=>{
 const evidence=prepared(),original=Buffer.from(evidence.payload),digest=hash(original);let release,started;
 const gate=new Promise(r=>{release=r;});const ready=new Promise(r=>{started=r;});
 const resultPromise=storePreparedEvidence(evidence,{upload:async(key,bytes,options)=>{assert.notEqual(bytes,evidence.payload);assert.equal(options.overwrite,false);started();await gate;assert.deepEqual(bytes,original);return true;},read:async key=>{assert.equal(key,'global/synthetic/original.json');return Buffer.from(original);}});
 await ready;evidence.payload.fill(0);evidence.payloadSha256=hash(evidence.payload);evidence.objectKey='global/synthetic/changed.json';release();
 assert.deepEqual(await resultPromise,{status:'READBACK_VERIFIED',objectKey:'global/synthetic/original.json',payloadSha256:digest,eligibleForLivePromotion:false});
});
test('readback callback cannot change expected hash and length to accept tampering',async()=>{
 const evidence=prepared();const returned=Buffer.from('different length');
 const result=await storePreparedEvidence(evidence,{upload:async()=>true,read:async()=>{evidence.payload=returned;evidence.payloadSha256=hash(returned);return returned;}});
 assert.equal(result.status,'REJECTED');assert.equal(result.reason,'READBACK_MISMATCH');
});
test('transport mutations do not mutate the original caller buffer',async()=>{
 const evidence=prepared(),original=Buffer.from(evidence.payload);
 const result=await storePreparedEvidence(evidence,{upload:async(key,bytes)=>{bytes.fill(0);return true;},read:async()=>Buffer.alloc(original.length)});
 assert.deepEqual(evidence.payload,original);assert.equal(result.reason,'READBACK_MISMATCH');
});
test('caller mutation while readback awaits preserves original verification identity',async()=>{
 const evidence=prepared(),original=Buffer.from(evidence.payload),digest=hash(original);let release,started;
 const gate=new Promise(r=>{release=r;});const ready=new Promise(r=>{started=r;});
 const pending=storePreparedEvidence(evidence,{upload:async()=>true,read:async key=>{assert.equal(key,'global/synthetic/original.json');started();await gate;return original;}});
 await ready;evidence.objectKey='global/synthetic/changed.json';evidence.payload=Buffer.alloc(1);evidence.payloadSha256=hash(evidence.payload);release();
 assert.deepEqual(await pending,{status:'READBACK_VERIFIED',objectKey:'global/synthetic/original.json',payloadSha256:digest,eligibleForLivePromotion:false});
});
