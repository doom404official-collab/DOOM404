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

for(const patch of [{errors:[{stage:'slot_mismatch'}]},{errors:[{stage:'retry_guard'}]},{stopReason:'RETRIEVAL_INCOMPLETE'},{pendingSignatures:[b]}])
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

test('offline consumer workflows cover shared validators without cancelling each other',async()=>{
 const {readFile}=await import('node:fs/promises');
 for(const name of ['glitch-liquidity-lq08-auto-worker-offline.yml','glitch-liquidity-lq08-runtime-contract-offline.yml','glitch-liquidity-lq08c-offline.yml']){
  const workflow=await readFile(new URL(`../../../.github/workflows/${name}`,import.meta.url),'utf8');
  assert.ok(workflow.includes("- 'mvp/wallet-signal/lib/liquidity*.mjs'"));
  assert.ok(workflow.includes("- 'mvp/wallet-signal/scripts/liquidity-validate-successor.mjs'"));
  assert.ok(workflow.includes('group: glitch-liquidity-offline-${{ github.workflow }}-${{ github.ref }}'));
  assert.ok(!workflow.includes('workflow_dispatch:')&&!workflow.includes('schedule:'));
 }
});
