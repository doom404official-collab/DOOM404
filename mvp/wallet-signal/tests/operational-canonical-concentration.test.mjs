import test from 'node:test';
import assert from 'node:assert/strict';
import {adaptDashboardEvidence} from '../lib/glitchDashboardEvidenceV11.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const canonicalHolder={mint,schemaVersion:2,snapshotId:'0596510d6dc07e1dce934fba0dcf96a5594b38807383bd6d829d9d6fe441177b',holderSetHash:'77f749040d291e057c546d1f4872f4de9432bdda4be512a0dc94bda14bc20daa',contextSlots:{inventory:474029636},status:'canonical_observation',top20SharePct:24.5379};
test('accepted canonical concentration contributes only its approved 35 point component',()=>{
 const r=adaptDashboardEvidence({result:{mint},workerEvidence:{version:'1.1',mint,canonicalHolder}});
 assert.equal(r.top20,24.5379);assert.equal(r.scores.holder_intelligence.components[0].points,28.32);
 assert.equal(r.scores.holder_intelligence.coveragePct,35);assert.equal(r.scores.holder_intelligence.score,null);
 for(const c of r.scores.holder_intelligence.components.slice(1))assert.equal(c.points,null);
});
test('foreign hash, snapshot and mint never inherit accepted concentration',()=>{
 for(const patch of [{holderSetHash:'bad'},{snapshotId:'bad'},{mint:'So11111111111111111111111111111111111111112'}]){
  const r=adaptDashboardEvidence({result:{mint},workerEvidence:{version:'1.1',mint,canonicalHolder:{...canonicalHolder,...patch}}});
  assert.equal(r.scores.holder_intelligence.components[0].points,null);
 }
});
