import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreHolderIntelligence} from '../lib/glitchAttributeEnginesV11.mjs';
// The current production assessment already withholds these components. This
// guards the shared engine boundary, not a claim of inflated live scores.
const complete={top20SharePct:15,networkScore:35,creatorTeamExposurePct:1,independencePoints:10,historyComplete:true,classificationComplete:true,creatorAttributionComplete:true};
const parts=r=>Object.fromEntries(r.components.map(c=>[c.id,c.points]));
const cases=[['historyComplete',['connected_wallet_network','holder_breadth_independence'],55],['classificationComplete',['holder_breadth_independence'],90],['creatorAttributionComplete',['creator_team_exposure'],80]];
for(const [flag,withheld,coverage] of cases){
 for(const [label,value] of [['missing',undefined],['null',null],['false',false],['string false','false'],['string true','true'],['zero',0],['one',1],['empty string',''],['array',[]],['object',{}]]){
  test(`${flag}: ${label} is not verified evidence`,()=>{
   const input={...complete,[flag]:value};if(label==='missing')delete input[flag];
   const result=scoreHolderIntelligence(input),baseline=scoreHolderIntelligence(complete);
   assert.equal(result.score,null);assert.equal(result.complete,false);assert.equal(result.coveragePct,coverage);
   for(const [id,points] of Object.entries(parts(baseline)))assert.equal(parts(result)[id],withheld.includes(id)?null:points);
  });
 }
}
test('literal true preserves full points and unchanged partial formulas',()=>{
 const full=scoreHolderIntelligence(complete);assert.equal(full.score,100);assert.equal(full.complete,true);assert.equal(full.coveragePct,100);assert.equal(full.calibrated,false);
 const partial=scoreHolderIntelligence({...complete,top20SharePct:40,networkScore:12,creatorTeamExposurePct:10.5,independencePoints:5});
 assert.deepEqual(Object.values(parts(partial)),[17.5,12,10,5]);assert.equal(partial.score,44.5);
 const unknown=scoreHolderIntelligence({top20SharePct:15});assert.deepEqual(Object.values(parts(unknown)),[35,null,null,null]);assert.equal(unknown.coveragePct,35);assert.equal(unknown.score,null);
});
test('true verification does not rescue absent or malformed numeric evidence',()=>{
 const result=scoreHolderIntelligence({...complete,networkScore:'35',creatorTeamExposurePct:NaN,independencePoints:undefined});
 assert.deepEqual(Object.values(parts(result)),[35,null,null,null]);assert.equal(result.coveragePct,35);assert.equal(result.score,null);
});
