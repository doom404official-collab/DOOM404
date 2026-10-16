import test from 'node:test';
import assert from 'node:assert/strict';
import {runStagedDiagnostic} from './heliusStagedDiagnostic.mjs';
test('successful stages progress 2,5,8',async()=>{
 const r=await runStagedDiagnostic({rpc:async()=>({success:true,rateLimited:false}),wait:async()=>{}});
 assert.deepEqual(r.stages.map(s=>s.requests),[2,5,8]);
 assert.equal(r.status,'completed');
});
test('a 429 stops escalation immediately',async()=>{
 let n=0;
 const r=await runStagedDiagnostic({rpc:async()=>({success:++n!==2,rateLimited:n===2}),wait:async()=>{}});
 assert.equal(r.status,'stopped_on_error');assert.equal(r.stages.length,1);
});
