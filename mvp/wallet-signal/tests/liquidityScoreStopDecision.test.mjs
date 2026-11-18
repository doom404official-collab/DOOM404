import test from 'node:test';
import assert from 'node:assert/strict';
import {assessLiquidityScoreStop, LIQUIDITY_STOP_QUESTIONS} from '../lib/liquidityScoreStopDecision.mjs';

const complete = () => Object.fromEntries([
  ['classification','AMOUNT_RECONCILED_AUTHORIZATION_PENDING'],
  ['provenanceVerified',true],
  ...LIQUIDITY_STOP_QUESTIONS.map(question => [question,true])
]);

test('returns advisory candidate without RPC when all assertions are true', () => {
  assert.deepEqual(assessLiquidityScoreStop(complete()), {
    action:'STOP_CANDIDATE_REQUIRES_TRUSTED_PROOF', reason:'ASSERTIONS_COMPLETE_PROOF_NOT_INDEPENDENTLY_VALIDATED', requests:0
  });
});
test('each missing scoring question prevents resolved stop', () => {
  for (const question of LIQUIDITY_STOP_QUESTIONS) {
    const evidence=complete(); evidence[question]=false;
    const result=assessLiquidityScoreStop(evidence);
    assert.equal(result.action,'CONTINUE_TARGETED');
    assert.deepEqual(result.missing,[question]);
    assert.equal(result.requests,0);
  }
});
test('missing provenance pauses and cannot promote', () => {
  const evidence=complete(); evidence.provenanceVerified=false;
  assert.equal(assessLiquidityScoreStop(evidence).action,'PAUSE_UNRESOLVED');
});
test('rejects invalid input and classification', () => {
  assert.throws(()=>assessLiquidityScoreStop(null),/LIQUIDITY_EVIDENCE_REQUIRED/);
  assert.throws(()=>assessLiquidityScoreStop({...complete(),classification:'SAFE'}),/LIQUIDITY_CLASSIFICATION_MISMATCH/);
});
test('decision is deterministic and does not mutate evidence', () => {
  const evidence=Object.freeze(complete());
  assert.deepEqual(assessLiquidityScoreStop(evidence),assessLiquidityScoreStop(evidence));
});
