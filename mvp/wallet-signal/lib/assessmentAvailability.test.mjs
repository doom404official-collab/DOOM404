import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveAssessmentState} from './assessmentAvailability.mjs';
const snapshot={id:'a'.repeat(64),created_at:'2026-10-15T12:00:00Z'};
test('missing token assessment requires investigation',()=>{
 assert.equal(resolveAssessmentState({}).status,'not_assessed');
});
test('incomplete batches are pending',()=>{
 assert.equal(resolveAssessmentState({snapshot,batches:[{status:'partial'}]}).status,'investigation_pending');
});
test('complete sampled batches are available even with partial historical coverage',()=>{
 const r=resolveAssessmentState({snapshot,batches:Array.from({length:4},()=>({status:'partial'})),now:Date.parse('2026-10-15T13:00:00Z')});
 assert.equal(r.status,'available');assert.equal(r.partialBatches,4);
});
test('old assessment is stale rather than silently fresh',()=>{
 const r=resolveAssessmentState({snapshot,batches:Array.from({length:4},()=>({status:'partial'})),now:Date.parse('2026-10-16T13:00:00Z')});
 assert.equal(r.status,'stale');
});
