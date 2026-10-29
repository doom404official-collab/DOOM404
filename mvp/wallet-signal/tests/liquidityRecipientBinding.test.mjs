import test from 'node:test';
import assert from 'node:assert/strict';
import {assessCollectFeeRecipientBinding} from '../lib/liquidityRecipientBinding.mjs';
import {PUMP_AMM_PROGRAM} from '../lib/liquidityHistoricalDecoder.mjs';
const event=()=>({operation:'collect_coin_creator_fee',programId:PUMP_AMM_PROGRAM,
  rawInstruction:{accounts:['mint','token','creator','authority','vault','destination','event',PUMP_AMM_PROGRAM]}});
const reference=()=>({creator:'creator',destinationTokenAccount:'destination'});
test('address match is not proof of authorized recipient',()=>{
  const result=assessCollectFeeRecipientBinding(event(),reference());
  assert.equal(result.status,'RECIPIENT_ADDRESS_MATCH_UNVERIFIED');
  assert.equal(result.recipientMatched,true);
  assert.equal(result.proofVerified,false);
});
test('mismatch remains unresolved, never silently safe',()=>{
  const r=reference();r.destinationTokenAccount='different';
  const result=assessCollectFeeRecipientBinding(event(),r);
  assert.equal(result.status,'RECIPIENT_ADDRESS_MISMATCH');
  assert.equal(result.proofVerified,false);
});
test('missing reference and invalid layout cannot establish binding',()=>{
  assert.equal(assessCollectFeeRecipientBinding(event(),null).status,'REFERENCE_UNAVAILABLE');
  const e=event();e.rawInstruction.accounts[7]='wrong';
  assert.equal(assessCollectFeeRecipientBinding(e,reference()).status,'LAYOUT_NOT_ESTABLISHED');
});
