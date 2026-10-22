import test from 'node:test';
import assert from 'node:assert/strict';
import {assessOfflineEvidencePreservation as assess} from '../lib/liquidityAutoWorkerEvidenceGate.mjs';
const a='1'.repeat(64),b='2'.repeat(64),pool='11111111111111111111111111111111';
const prior={pool,seen:[a],reconciliation:{sourceDigest:'a'.repeat(64)}};
const next={...prior,seen:[a,b],authorizationVerified:false,withdrawalVerified:false,finalScore:null,complete:false,historyCoverageVerified:false,pendingSignatures:[],stopReason:'CHECKPOINTED'};
test('safe successor candidate requires proper artifact name',()=>{
 assert.equal(assess({prior,next,artifactName:'liquidity-history-39729408869'}).checkpointEligible,true);
 assert.throws(()=>assess({prior,next,artifactName:'liquidity-history-partial-123'}));
});
test('pending evidence stays isolated without promotion',()=>{
 const x=assess({prior,next:{...next,pendingSignatures:[b]},artifactName:'liquidity-history-partial-123'});
 assert.equal(x.checkpointEligible,false);
});
test('provenance, lineage and score promotion fail closed',()=>{
 for(const changed of [{...next,pool:'wrong'},{...next,seen:[]},{...next,finalScore:10},{...next,historyCoverageVerified:true}])
  assert.throws(()=>assess({prior,next:changed,artifactName:'liquidity-history-123'}));
});
