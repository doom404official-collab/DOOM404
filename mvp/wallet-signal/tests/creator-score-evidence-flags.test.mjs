import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreCreatorIntelligence} from '../lib/glitchAttributeEnginesV11.mjs';
const positive={creatorVerified:true,holdingsPct:2,creatorHistoryComplete:true,soldPct1h:0,soldPct24h:0,soldPct7d:0,previousLaunchPoints:30,previousLaunchHistoryComplete:true};
const gated={creatorVerified:[0,1],creatorHistoryComplete:[2],previousLaunchHistoryComplete:[3]};
const invalid=[['false',false],['missing',undefined],['null',null],['string false','false'],['string true','true'],['number one',1],['number zero',0],['object',{}],['array',[]],['boxed true',new Boolean(true)]];
for(const [flag,indexes] of Object.entries(gated))for(const [label,value] of invalid){
 test(`${flag} rejects ${label} without changing independently evidenced components`,()=>{
  const result=scoreCreatorIntelligence({...positive,[flag]:value});
  assert.equal(result.complete,false);assert.equal(result.score,null);assert.equal(result.calibrated,false);
  assert.deepEqual(result.components.map(c=>c.max),[20,20,30,30]);
  result.components.forEach((c,index)=>assert.equal(c.points,indexes.includes(index)?null:c.max));
  assert.equal(result.coveragePct,100-indexes.reduce((sum,index)=>sum+result.components[index].max,0));
 });
}
test('three string false verification flags cannot fabricate a complete perfect score',()=>{
 const result=scoreCreatorIntelligence({...positive,creatorVerified:'false',creatorHistoryComplete:'false',previousLaunchHistoryComplete:'false'});
 assert.equal(result.score,null);assert.equal(result.complete,false);assert.equal(result.coveragePct,0);
 assert.deepEqual(result.components.map(c=>c.points),[null,null,null,null]);
});
test('boolean true retains existing complete score, weights and calibration',()=>{
 const result=scoreCreatorIntelligence(positive);
 assert.equal(result.score,100);assert.equal(result.complete,true);assert.equal(result.coveragePct,100);assert.equal(result.calibrated,false);
 assert.deepEqual(result.components.map(c=>[c.max,c.points]),[[20,20],[20,20],[30,30],[30,30]]);
});
test('boolean true retains existing non-perfect numeric formulas',()=>{
 const result=scoreCreatorIntelligence({...positive,holdingsPct:20,soldPct1h:50,soldPct24h:25,soldPct7d:0,previousLaunchPoints:15});
 assert.equal(result.score,50);assert.equal(result.complete,true);assert.equal(result.coveragePct,100);
 assert.deepEqual(result.components.map(c=>c.points),[20,0,15,15]);
});
