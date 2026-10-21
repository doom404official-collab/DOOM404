import test from 'node:test';
import assert from 'node:assert/strict';
import {PUMP_GLOBAL_SCHEMA_COMMIT,PUMP_GLOBAL_SCHEMA_FIELDS,expectedPinnedGlobalBytes} from '../lib/pumpFunPinnedGlobalSchema.mjs';
test('pinned May Global IDL candidate serializes to archived 1045 bytes',()=>{
 assert.equal(PUMP_GLOBAL_SCHEMA_COMMIT,'3c6721a67c0b206b39130b454c8ba22a83ce972e');
 assert.equal(PUMP_GLOBAL_SCHEMA_FIELDS.length,25);
 assert.equal(expectedPinnedGlobalBytes(),1045);
});
test('candidate layout includes all relevant fee categories without authorizing them',()=>{
 const names=PUMP_GLOBAL_SCHEMA_FIELDS.map(([name])=>name);
 for(const field of ['fee_recipient','fee_recipients','creator_fee_basis_points','reserved_fee_recipient','reserved_fee_recipients','buyback_fee_recipients','buyback_basis_points'])assert.ok(names.includes(field));
});
