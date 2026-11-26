import test from 'node:test';
import assert from 'node:assert/strict';
import {assessmentBounds} from '../lib/assessmentBounds.mjs';
import {scoreTokenSecurity,scoreHolderIntelligence} from '../lib/glitchAttributeEnginesV11.mjs';
test('missing evidence widens uncertainty instead of earning safety points',()=>{
 assert.deepEqual(assessmentBounds({}),{lower:0,upper:100,coveragePct:0,status:'limited_assessment',calibrated:false});
 const s=scoreTokenSecurity({tokenProgram:'spl-token',authoritiesParsed:true,mintAuthority:null,freezeAuthority:null});
 const r=assessmentBounds({token_security:s,holder_intelligence:scoreHolderIntelligence({top20SharePct:24.5379})});
 assert.equal(r.lower,32.08);assert.equal(r.upper,98.33);assert.equal(r.coveragePct,33.75);
});
test('malformed and foreign weighted assessments cannot manufacture a narrow range',()=>{
 for(const value of [{components:[]},{version:'foreign',components:[]},{attribute:'creator_intelligence',components:[]}])assert.equal(assessmentBounds({token_security:value}).lower,0);
});
