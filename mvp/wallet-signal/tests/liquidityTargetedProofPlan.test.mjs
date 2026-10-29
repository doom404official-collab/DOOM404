import test from 'node:test';
import assert from 'node:assert/strict';
import {planLiquidityTargetedProof} from '../lib/liquidityTargetedProofPlan.mjs';
const fixture=()=>({
  schemaVersion:1,pool:'pool',classification:'AMOUNT_RECONCILED_AUTHORIZATION_PENDING',
  before:null,seen:['s1','s2'],pendingSignatures:[],
  events:[
    {signature:'s1',slot:10,operation:'collect_coin_creator_fee',classification:'UNVERIFIED_CANDIDATE',eligibleForAuthorizationReview:true},
    {signature:'s1',slot:10,operation:'set_coin_creator',classification:'UNVERIFIED_CANDIDATE',eligibleForAuthorizationReview:true},
    {signature:'s2',slot:9,operation:'transfer_creator_fees_to_pump',classification:'UNVERIFIED_CANDIDATE',eligibleForAuthorizationReview:false}
  ]
});
test('deduplicates multiple candidate instructions within one transaction',()=>{
  const result=planLiquidityTargetedProof(fixture(),'pool');
  assert.equal(result.distinctTransactions,1);
  assert.deepEqual(result.targets[0].operations,['collect_coin_creator_fee','set_coin_creator']);
  assert.equal(result.liveRpcAuthorized,false);
  assert.equal(result.scorePromotable,false);
});
test('invalid unobserved candidate is quarantined',()=>{
  const f=fixture(); f.events.push({signature:'unknown',slot:11,classification:'UNVERIFIED_CANDIDATE',eligibleForAuthorizationReview:true});
  const result=planLiquidityTargetedProof(f,'pool');
  assert.equal(result.action,'PAUSE_INVALID_CANDIDATES');
  assert.equal(result.invalidCandidates,1);
});
test('checkpoint validation and pool binding are mandatory',()=>{
  assert.throws(()=>planLiquidityTargetedProof(fixture(),'other'),/INVALID_HISTORY_CHECKPOINT/);
  const f=fixture(); f.events[0].authorizationVerified=true;
  assert.throws(()=>planLiquidityTargetedProof(f,'pool'),/UNSAFE_HISTORY_EVENT_PROMOTION/);
});

test('conflicting slots quarantine a signature even if it appears again',()=>{
  const f=fixture();
  f.events.push({signature:'s1',slot:11,operation:'set_coin_creator',
    classification:'UNVERIFIED_CANDIDATE',eligibleForAuthorizationReview:true});
  f.events.push({signature:'s1',slot:10,operation:'collect_coin_creator_fee',
    classification:'UNVERIFIED_CANDIDATE',eligibleForAuthorizationReview:true});
  const result=planLiquidityTargetedProof(f,'pool');
  assert.equal(result.action,'PAUSE_INVALID_CANDIDATES');
  assert.equal(result.distinctTransactions,0);
  assert.equal(result.invalidCandidates,2);
});
test('no eligible events does not imply a safe or promotable score',()=>{
  const f=fixture(); f.events=[];
  const result=planLiquidityTargetedProof(f,'pool');
  assert.equal(result.distinctTransactions,0);
  assert.equal(result.scorePromotable,false);
  assert.equal(result.liveRpcAuthorized,false);
});
