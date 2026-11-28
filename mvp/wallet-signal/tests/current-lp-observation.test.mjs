import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {projectCurrentLpObservation} from '../lib/currentLpObservation.mjs';
import {projectLiquidityCheckpoint} from '../lib/dashboardEvidenceBridge.mjs';
import {adaptDashboardEvidence} from '../lib/glitchDashboardEvidenceV11.mjs';
const fixture=()=>JSON.parse(readFileSync(new URL('../docs/liquidity-lp-observation-2026-11-26.json',import.meta.url)));
test('recovered current LP balances survive stale pool checks without safety points',()=>{
 const e=fixture(),l=projectLiquidityCheckpoint({mint:e.mint,updated_at:e.observedAt,evidence:{mint:e.mint,schemaVersion:1,
  observedAt:'2026-10-19T11:35:13.965Z',pools:[],batchErrors:[],status:'partial',finalScore:null,verifiedDepth:false,lpSecurityVerified:false,currentLpObservation:e}},e.mint);
 const out=adaptDashboardEvidence({result:{mint:e.mint},now:Date.parse(e.observedAt),workerEvidence:{version:'1.1',mint:e.mint,liquidity:l}});
 assert.equal(out.liquidity,null);assert.equal(out.lpObservation.holders.length,2);
 assert.equal(out.lpObservation.observedBalanceSumEqualsSupply,true);
 assert.equal(out.lpObservation.historicalOwnershipVerified,false);
 assert.ok(out.scores.liquidity_quality_safety.components.every(c=>c.points===null));
 assert.equal(adaptDashboardEvidence({result:{mint:e.mint},now:Date.parse(e.observedAt)+3600001,workerEvidence:{version:'1.1',mint:e.mint,liquidity:l}}).lpObservation,null);
});
for(const [name,change] of [
 ['duplicate account',e=>e.holders.push(e.holders[0])],
 ['supply contradiction',e=>e.mintSupplyRaw='1'],
 ['safety assertion',e=>e.lpSecurityVerified=true],
 ['historical assertion',e=>e.historicalOwnershipVerified=true],
 ['regressed context',e=>e.observationSlot=1],
])test(`LP projection rejects ${name}`,()=>{const e=fixture();change(e);assert.throws(()=>projectCurrentLpObservation(e,e.mint));});
