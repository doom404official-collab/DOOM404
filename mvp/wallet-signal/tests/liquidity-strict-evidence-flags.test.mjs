import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreLiquidityQuality} from '../lib/glitchAttributeEnginesV11.mjs';
import {adaptDashboardEvidence} from '../lib/glitchDashboardEvidenceV11.mjs';
// Engine-boundary hardening: the live adapter already withholds these inputs.
const positive={verifiedDepthUsd:250000,verifiedMarketCapUsd:1000000,lpSecurityPoints:25,lpVerified:true,largestIndependentPoolSharePct:40,impactPct:1,impactVerified:true,stabilityPoints:10,stabilityVerified:true};
const gates={lpVerified:2,impactVerified:4,stabilityVerified:5};
const weights=[25,20,25,10,10,10];
const invalid=[['missing',undefined],['null',null],['false',false],['string false','false'],['string true','true'],['one',1],['zero',0],['empty string',''],['object',{}],['array',[]],['boxed true',new Boolean(true)]];
for(const [flag,index] of Object.entries(gates))for(const [label,value] of invalid){
 test(`${flag}: ${label} cannot authorize liquidity evidence`,()=>{
  const input={...positive,[flag]:value};if(label==='missing')delete input[flag];
  const result=scoreLiquidityQuality(input);
  assert.equal(result.score,null);assert.equal(result.complete,false);assert.equal(result.calibrated,false);
  assert.deepEqual(result.components.map(c=>c.max),weights);
  assert.deepEqual(result.components.map((c,i)=>c.points),weights.map((w,i)=>i===index?null:w));
  assert.equal(result.coveragePct,100-weights[index]);
 });
}
test('combined string false flags withhold only the three gated components',()=>{
 const r=scoreLiquidityQuality({...positive,lpVerified:'false',impactVerified:'false',stabilityVerified:'false'});
 assert.deepEqual(r.components.map(c=>c.points),[25,20,null,10,null,null]);assert.equal(r.coveragePct,55);assert.equal(r.score,null);assert.equal(r.complete,false);
});
test('literal true preserves full score and weights',()=>{
 const r=scoreLiquidityQuality(positive);assert.equal(r.score,100);assert.equal(r.complete,true);assert.equal(r.coveragePct,100);assert.equal(r.calibrated,false);
 assert.deepEqual(r.components.map(c=>[c.max,c.points]),weights.map(w=>[w,w]));
});
test('literal true preserves non-perfect numeric formulas',()=>{
 const r=scoreLiquidityQuality({...positive,verifiedDepthUsd:130000,verifiedMarketCapUsd:1000000,lpSecurityPoints:12,largestIndependentPoolSharePct:70,impactPct:8,stabilityPoints:4});
 assert.deepEqual(r.components.map(c=>c.points),[12.5,12.22,12,5,5,4]);assert.equal(r.score,50.72);assert.equal(r.complete,true);
});
test('true flags cannot rescue missing or malformed numeric evidence',()=>{
 const r=scoreLiquidityQuality({...positive,lpSecurityPoints:'25',impactPct:NaN,stabilityPoints:undefined});
 assert.deepEqual(r.components.map(c=>c.points),[25,20,null,10,null,null]);assert.equal(r.score,null);assert.equal(r.coveragePct,55);
});
test('empty dashboard evidence does not fabricate a liquidity score',()=>{
 const r=adaptDashboardEvidence({}).scores.liquidity_quality_safety;
 assert.equal(r.score,null);assert.equal(r.complete,false);assert.equal(r.coveragePct,0);assert.ok(r.components.every(c=>c.points===null));
});
