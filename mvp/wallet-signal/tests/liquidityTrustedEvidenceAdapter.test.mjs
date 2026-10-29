import test from 'node:test';
import assert from 'node:assert/strict';
import {assessLiquidityCheckpointForEarlyStop} from '../lib/liquidityTrustedEvidenceAdapter.mjs';
const checkpoint = () => ({
  schemaVersion: 1, pool: 'pool-fixture',
  classification: 'AMOUNT_RECONCILED_AUTHORIZATION_PENDING',
  events: [{authorizationVerified:false, accountRolesVerified:false,
    signerAuthorizationVerified:false}], seen: ['sig-fixture']
});
test('historical decoder candidate cannot authorize early stop', () => {
  const result = assessLiquidityCheckpointForEarlyStop(checkpoint(), 'pool-fixture');
  assert.equal(result.action, 'PAUSE_UNRESOLVED');
  assert.equal(result.historicalEvents, 1);
});
test('rejects wrong pool and missing history', () => {
  assert.throws(() => assessLiquidityCheckpointForEarlyStop(checkpoint(), 'wrong'));
  assert.throws(() => assessLiquidityCheckpointForEarlyStop({}, 'pool-fixture'));
});
test('rejects unsupported proof promotion', () => {
  const evidence = checkpoint(); evidence.events[0].authorizationVerified = true;
  assert.throws(() => assessLiquidityCheckpointForEarlyStop(evidence, 'pool-fixture'),
    /UNSUPPORTED_HISTORICAL_PROOF_PROMOTION/);
});
