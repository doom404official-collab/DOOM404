import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,access,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const pool='11111111111111111111111111111111',a='1'.repeat(64),b='2'.repeat(64),c='3'.repeat(64);
const prior={schemaVersion:1,pool,before:a,seen:[a],events:[],pages:1,pendingSignatures:[],pendingSignatureCount:0,unresolvedReasons:{},errors:[],complete:false,historyCoverageVerified:false,authorizationVerified:false,withdrawalVerified:false,finalScore:null,classification:'AMOUNT_RECONCILED_AUTHORIZATION_PENDING',requestCount:60,stopReason:'CHECKPOINTED',reconciliation:{reconciliationStatus:'PENDING_SIGNATURES_RECONCILED_HISTORY_UNVERIFIED',originalPendingSignatureCount:2,originalStopReason:'RETRIEVAL_INCOMPLETE',sourceDigest:'a'.repeat(64),replayDigest:'b'.repeat(64),originalSeen:32,recoveredPending:2,verifiedDistinct:34,candidateCount:0,historyExhausted:false}};
const cli=name=>new URL('../scripts/'+name,import.meta.url).pathname;
const invoke=(name,args)=>spawnSync(process.execPath,[cli(name),...args],{encoding:'utf8',env:{...process.env,GLITCH_LIQUIDITY_POOL:pool}});
test('failed-run output yields sanitized isolated partial and diagnostic',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'pr46-failure-'));
 try{
  const p=join(dir,'prior.json'),n=join(dir,'failed.json'),partial=join(dir,'partial.json'),diag=join(dir,'diagnostic.json');
  const marker='SYNTHETIC_PROVIDER_SECRET_DO_NOT_UPLOAD';
  const next={...structuredClone(prior),seen:[a,b],pendingSignatures:[c],pendingSignatureCount:1,unresolvedReasons:{[c]:'RPC_TRANSACTION_UNAVAILABLE'},requestCount:120,stopReason:'RETRIEVAL_INCOMPLETE',errors:[{stage:'transaction',signature:c,message:marker}]};
  await writeFile(p,JSON.stringify(prior));await writeFile(n,JSON.stringify(next));
  assert.equal(invoke('liquidity-prepare-partial-recovery.mjs',[p,n,partial]).status,0);
  assert.equal(invoke('liquidity-preserve-failure-diagnostic.mjs',[n,diag]).status,0);
  const partialState=JSON.parse(await readFile(partial,'utf8')),diagnostic=JSON.parse(await readFile(diag,'utf8'));
  assert.equal(partialState.seen.length,2);assert.equal(partialState.finalScore,null);assert.equal(partialState.authorizationVerified,false);
  assert.equal(diagnostic.continuationEligible,false);
  assert.equal(JSON.stringify(partialState).includes(marker),false);
  assert.equal(JSON.stringify(diagnostic).includes(marker),false);
  assert.notEqual(invoke('liquidity-prepare-partial-recovery.mjs',[p,n,partial]).status,0);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('advanced cursor fails partial validation but diagnostic remains available',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'pr46-advanced-'));
 try{
  const p=join(dir,'prior.json'),n=join(dir,'failed.json'),partial=join(dir,'partial.json'),diag=join(dir,'diagnostic.json');
  await writeFile(p,JSON.stringify(prior));await writeFile(n,JSON.stringify({...structuredClone(prior),before:b,seen:[a,b],pendingSignatures:[c],pendingSignatureCount:1,unresolvedReasons:{[c]:'REQUEST_BUDGET_EXHAUSTED'},requestCount:120,stopReason:'REQUEST_BUDGET_EXHAUSTED'}));
  assert.notEqual(invoke('liquidity-prepare-partial-recovery.mjs',[p,n,partial]).status,0);
  await assert.rejects(access(partial));
  assert.equal(invoke('liquidity-preserve-failure-diagnostic.mjs',[n,diag]).status,0);
  assert.equal(JSON.parse(await readFile(diag,'utf8')).continuationEligible,false);
 }finally{await rm(dir,{recursive:true,force:true});}
});
