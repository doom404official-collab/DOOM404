import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {validateLiquidityPartialRecovery as validate,prepareLiquidityPartialRecovery as prepare} from '../lib/liquidityPartialRecovery.mjs';
import {assessAutomaticHistoryCheckpoint} from '../lib/liquidityAutomaticHistoryGate.mjs';
const a='1'.repeat(64),b='2'.repeat(64),c='3'.repeat(64),pool='1'.repeat(32);
const prior={schemaVersion:1,pool,before:a,seen:[a],events:[],pages:1,pendingSignatures:[],pendingSignatureCount:0,unresolvedReasons:{},errors:[],complete:false,historyCoverageVerified:false,authorizationVerified:false,withdrawalVerified:false,finalScore:null,classification:'AMOUNT_RECONCILED_AUTHORIZATION_PENDING',requestCount:60,stopReason:'CHECKPOINTED',reconciliation:{reconciliationStatus:'PENDING_SIGNATURES_RECONCILED_HISTORY_UNVERIFIED',originalPendingSignatureCount:2,originalStopReason:'RETRIEVAL_INCOMPLETE',sourceDigest:'a'.repeat(64),replayDigest:'b'.repeat(64),originalSeen:32,recoveredPending:2,verifiedDistinct:34,candidateCount:0,historyExhausted:false}};
const next=()=>({...structuredClone(prior),seen:[a,b],pendingSignatures:[c],pendingSignatureCount:1,unresolvedReasons:{[c]:'REQUEST_BUDGET_EXHAUSTED'},requestCount:120,stopReason:'REQUEST_BUDGET_EXHAUSTED'});
test('partial preserves provenance and pending, never promotes continuation or scores',()=>{
 const n=next(),p=prepare(prior,n,pool);assert.equal(p.summary.newlyCompleted,1);assert.deepEqual(p.state,n);assert.equal(assessAutomaticHistoryCheckpoint(p.state,pool).action,'PAUSE_UNRESOLVED_SIGNATURES');
 assert.throws(()=>validate(prior,{...n,before:b},pool),/CURSOR_ADVANCED/); // legitimate advanced-page recovery deliberately unsupported
 assert.throws(()=>validate(prior,{...n,pages:2},pool),/CURSOR_ADVANCED/);
 for(const patch of [{finalScore:1},{complete:true},{authorizationVerified:true},{historyCoverageVerified:true}])assert.throws(()=>validate(prior,{...n,...patch},pool));
});
test('rejects inconsistent sets, counts, reasons and provenance',()=>{
 for(const patch of [{pendingSignatureCount:0},{unresolvedReasons:{}},{pendingSignatures:[c,c],pendingSignatureCount:2},{pendingSignatures:[a]},{seen:[a,a]},{seen:[b]},{requestCount:59},{requestCount:NaN},{reconciliation:{...prior.reconciliation,replayDigest:'c'.repeat(64)}}])assert.throws(()=>validate(prior,{...next(),...patch},pool));
});
test('never discards prior events; candidate-bearing schema fails closed',()=>{
 const event={signature:a,classification:'UNVERIFIED_CANDIDATE',authorizationVerified:false};
 assert.throws(()=>validate({...prior,events:[event]},next(),pool),/EVENT_REGRESSION/);
 assert.throws(()=>validate({...prior,events:[event]},{...next(),events:[event]},pool),/EVENT_SCHEMA_UNSUPPORTED/);
});
test('synthetic provider secrets removed; unknown state and malformed payloads rejected',()=>{
 const marker='SYNTHETIC_SECRET_DO_NOT_UPLOAD';const n=next();n.errors=[{stage:'transaction',signature:c,message:marker,unknown:marker}];
 const result=prepare(prior,n,pool);assert.equal(JSON.stringify(result).includes(marker),false);assert.equal(result.state.errors[0].stage,'transaction');
 for(const bad of [null,{}, {kind:'LIQUIDITY_HISTORY_FAILURE_DIAGNOSTIC',completedSignatures:[a,b]}, {...n,extra:marker},{...n,updatedAt:marker}])assert.throws(()=>prepare(prior,bad,pool));
});
test('CLI sanitizes output, refuses overwrite and malformed JSON without leaking input',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'partial-recovery-test-')),p=join(dir,'prior.json'),n=join(dir,'next.json'),o=join(dir,'partial.json');
 const marker='SYNTHETIC_SECRET_DO_NOT_UPLOAD';await writeFile(p,JSON.stringify(prior));await writeFile(n,JSON.stringify({...next(),errors:[{stage:'transaction',signature:c,message:marker}]}));
 const run=()=>spawnSync(process.execPath,[new URL('../scripts/liquidity-prepare-partial-recovery.mjs',import.meta.url).pathname,p,n,o],{encoding:'utf8',env:{...process.env,GLITCH_LIQUIDITY_POOL:pool}});
 assert.equal(run().status,0);const saved=await readFile(o,'utf8');assert.equal(saved.includes(marker),false);assert.notEqual(run().status,0);assert.equal(await readFile(o,'utf8'),saved);
 await writeFile(n,'{"'+marker);const failed=run();assert.notEqual(failed.status,0);assert.equal((failed.stderr+failed.stdout).includes(marker),false);assert.equal(await readFile(o,'utf8'),saved);
 const failedOutput=join(dir,'missing.json');const fail=spawnSync(process.execPath,[new URL('../scripts/liquidity-prepare-partial-recovery.mjs',import.meta.url).pathname,p,n,failedOutput],{encoding:'utf8',env:{...process.env,GLITCH_LIQUIDITY_POOL:pool}});assert.notEqual(fail.status,0);await assert.rejects(access(failedOutput));
});
test('no workflow wiring added; partial and diagnostic artifacts excluded from discovery',async()=>{
 const wf=await readFile(new URL('../../../.github/workflows/glitch-liquidity-history-controlled-worker.yml',import.meta.url),'utf8');assert.equal(wf.includes('liquidity-prepare-partial-recovery'),false);assert.ok(wf.includes('^liquidity-(reconciled|history)-[0-9]+$'));
 for(const name of ['liquidity-partial-123','liquidity-history-failure-123'])assert.equal(/^liquidity-(reconciled|history)-[0-9]+$/.test(name),false);
});
