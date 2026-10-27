import test from 'node:test';
import assert from 'node:assert/strict';
import {assessOfflineEvidencePreservation as assess} from '../lib/liquidityAutoWorkerEvidenceGate.mjs';
const a='1'.repeat(64),b='2'.repeat(64),pool='11111111111111111111111111111111';
const prior={schemaVersion:1,pool,before:a,seen:[a],events:[],pendingSignatures:[],complete:false,historyCoverageVerified:false,authorizationVerified:false,withdrawalVerified:false,finalScore:null,classification:'AMOUNT_RECONCILED_AUTHORIZATION_PENDING',reconciliation:{verifiedDistinct:34,recoveredPending:2,sourceDigest:'a'.repeat(64)},stopReason:'CHECKPOINTED',requestCount:60};
const next={...prior,seen:[a,b],authorizationVerified:false,withdrawalVerified:false,finalScore:null,complete:false,historyCoverageVerified:false,pendingSignatures:[],stopReason:'CHECKPOINTED'};
test('safe successor candidate requires proper artifact name',()=>{
 assert.equal(assess({prior,next,artifactName:'liquidity-history-39729408869'}).checkpointEligible,true);
 assert.throws(()=>assess({prior,next,artifactName:'liquidity-history-partial-123'}));
});
test('pending evidence stays isolated without promotion',()=>{
 const x=assess({prior,next:{...next,pendingSignatures:['3'.repeat(64)]},artifactName:'liquidity-history-partial-123'});
 assert.equal(x.checkpointEligible,false);
});
test('provenance, lineage and score promotion fail closed',()=>{
 for(const changed of [{...next,pool:'wrong'},{...next,seen:[]},{...next,finalScore:10},{...next,historyCoverageVerified:true}])
  assert.throws(()=>assess({prior,next:changed,artifactName:'liquidity-history-123'}));
});

for(const [name,patch,error] of [
 ['duplicate signatures',{seen:[a,a]},/DUPLICATE_HISTORY_SIGNATURES/],
 ['promoted event',{events:[{authorizationVerified:true,classification:'AUTHORIZED'}]},/UNSAFE_HISTORY_EVENT_PROMOTION/],
 ['missing schema',{schemaVersion:undefined},/INVALID_HISTORY_CHECKPOINT/],
 ['unverified exhaustion',{complete:true},/UNVERIFIED_HISTORY_EXHAUSTION/],
 ['request regression',{requestCount:0},/HISTORY_REQUEST_REGRESSION/],
 ['unchanged continuation',{},/HISTORY_NO_PROGRESS_MANUAL_REVIEW/],
 ['requests alone are not progress',{requestCount:61},/HISTORY_NO_PROGRESS_MANUAL_REVIEW/],
 ['reconciliation seed drift',{reconciliation:{...prior.reconciliation,verifiedDistinct:33}},/RECONCILED_HISTORY_SEED_REQUIRED/],
]) test(`reject ${name}`,()=>{
 assert.throws(()=>assess({prior,next:{...prior,...patch},artifactName:'liquidity-history-39729408870'}),error);
});

for(const patch of [{errors:[{stage:'slot_mismatch'}]},{errors:[{stage:'retry_guard'}]},{stopReason:'RETRIEVAL_INCOMPLETE'},{complete:true,historyCoverageVerified:true,stopReason:'RETRIEVAL_INCOMPLETE'},{pendingSignatures:[b]}])
 test(`canonical pause stays isolated: ${JSON.stringify(patch)}`,()=>{
  assert.deepEqual(assess({prior,next:{...prior,...patch},artifactName:'liquidity-history-partial-123'}),{action:'ISOLATE_PARTIAL_NO_PROMOTION',checkpointEligible:false});
 });

test('canonical progress and exhaustion semantics preserve valid candidates',()=>{
 for(const patch of [{seen:[a,b]},{before:b},{complete:true,historyCoverageVerified:true}])
  assert.equal(assess({prior,next:{...prior,...patch},artifactName:'liquidity-history-123'}).checkpointEligible,true);
});
test('retained non-blocking errors and unverified events remain acceptable',()=>{
 const errors=[{stage:'getTransaction',message:'historical retrieval failure'}];
 const baseline={...prior,errors};
 const successor={...next,errors,events:[{authorizationVerified:false,classification:'UNVERIFIED_CANDIDATE'}]};
 const snapshot=structuredClone({baseline,successor});
 assert.equal(assess({prior:baseline,next:successor,artifactName:'liquidity-history-123'}).checkpointEligible,true);
 assert.deepEqual({baseline,successor},snapshot);
});
test('predecessor must itself be a continuable canonical checkpoint',()=>{
 for(const patch of [{schemaVersion:undefined},{pendingSignatures:[b]},{complete:true,historyCoverageVerified:true}])
  assert.throws(()=>assess({prior:{...prior,...patch},next,artifactName:'liquidity-history-123'}));
});

test('successor CLI preserves canonical success, pause and no-progress behavior',async()=>{
 const {mkdtemp,writeFile,rm}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');
 const {join}=await import('node:path');
 const {spawnSync}=await import('node:child_process');
 const dir=await mkdtemp(join(tmpdir(),'liquidity-successor-'));
 try{
  const p=join(dir,'prior.json'),n=join(dir,'next.json');
  await writeFile(p,JSON.stringify(prior));
  for(const [patch,expected] of [
   [{seen:[a,b]},'CONTINUE_BOUNDED'],
   [{complete:true,historyCoverageVerified:true},'STOP_HISTORY_EXHAUSTED'],
   [{errors:[{stage:'slot_mismatch'}]},'PAUSE_EVIDENCE_ERROR'],
   [{pendingSignatures:[b]},'PAUSE_UNRESOLVED_SIGNATURES'],
   [{},'HISTORY_NO_PROGRESS_MANUAL_REVIEW'],
   [{requestCount:0},'HISTORY_REQUEST_REGRESSION'],
  ]){
   await writeFile(n,JSON.stringify({...prior,...patch}));
   const run=spawnSync(process.execPath,[new URL('../scripts/liquidity-validate-successor.mjs',import.meta.url).pathname,p,n],{encoding:'utf8',env:{...process.env,GLITCH_LIQUIDITY_POOL:pool}});
   if(expected.startsWith('HISTORY_')){assert.notEqual(run.status,0);assert.ok(run.stderr.includes(expected));}
   else{assert.equal(run.status,0,run.stderr);assert.deepEqual(JSON.parse(run.stdout),{status:'HISTORY_SUCCESSOR_VALIDATED',priorSeen:1,nextSeen:patch.seen?.length??1,action:expected,classification:prior.classification,score:null});}
  }
 }finally{await rm(dir,{recursive:true,force:true});}
});


for(const field of ['events','errors'])for(const change of ['remove','mutate'])test(`retained ${field} cannot ${change} in successor`,()=>{
 const retained=field==='events'?[{signature:a,authorizationVerified:false,classification:'UNVERIFIED_CANDIDATE',raw:'9007199254740993'}]:[{stage:'getTransaction',signature:a,message:'retained historical failure'}];
 const baseline={...prior,[field]:retained};const changed=change==='remove'?[]:[{...retained[0],signature:b}];
 assert.throws(()=>assess({prior:baseline,next:{...next,[field]:changed},artifactName:'liquidity-history-39729408870'}),/HISTORY_RETAINED_EVIDENCE_DRIFT/);
});
test('original signature prefix stays ordered and immutable',()=>{
 assert.throws(()=>assess({prior,next:{...next,seen:[b,a]},artifactName:'liquidity-history-39729408870'}),/HISTORY_SIGNATURE_ORDER_DRIFT/);
});
test('appended evidence preserves prior content without mutating either input',()=>{
 const event={signature:a,authorizationVerified:false,classification:'UNVERIFIED_CANDIDATE'},error={stage:'getTransaction',message:'retained'};
 const baseline={...prior,events:[event],errors:[error]};const successor={...next,events:[{...event},{...event,signature:b}],errors:[{...error}]};
 const snapshot=structuredClone({baseline,successor});assert.equal(assess({prior:baseline,next:successor,artifactName:'liquidity-history-39729408870'}).checkpointEligible,true);assert.deepEqual({baseline,successor},snapshot);
});

test('candidate selector applies the same preservation guard',async()=>{
 const {selectLiquidityContinuationCheckpoint}=await import('../lib/liquidityAutomaticCheckpointSelector.mjs');
 const baseline={...prior,errors:[{stage:'getTransaction',message:'retained'}]};
 assert.throws(()=>selectLiquidityContinuationCheckpoint([{runId:39729408869,state:baseline},{runId:39729408870,state:{...next,errors:[]}}],pool),/HISTORY_RETAINED_EVIDENCE_DRIFT/);
});
