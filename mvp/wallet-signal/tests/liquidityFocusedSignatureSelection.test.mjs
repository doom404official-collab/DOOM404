import test from 'node:test';
import assert from 'node:assert/strict';
import {selectFocusedLiquiditySignatures} from '../lib/liquidityFocusedSignatureSelection.mjs';
const signature='1'.repeat(64);
test('known signature bypasses list and selects exactly one transaction',()=>{
  const result=selectFocusedLiquiditySignatures({requestedSignature:signature});
  assert.equal(result.requiresSignatureList,false);
  assert.deepEqual(result.selected,[{signature,err:null}]);
  assert.equal(result.selection.excludedCount,0);
});
test('invalid focused signature is rejected before listing',()=>{
  assert.throws(()=>selectFocusedLiquiditySignatures({requestedSignature:'bad'}),/INVALID_TRANSACTION_SIGNATURE/);
});
test('discovery requires list input and remains separate',()=>{
  assert.throws(()=>selectFocusedLiquiditySignatures({}),/POOL_SIGNATURE_LIST_REQUIRED/);
  const result=selectFocusedLiquiditySignatures({poolSignatures:[]});
  assert.equal(result.requiresSignatureList,true);
  assert.equal(result.selected.length,0);
});
