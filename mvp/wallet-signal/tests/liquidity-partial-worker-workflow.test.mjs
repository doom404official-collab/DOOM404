import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {assessAutomaticHistoryCheckpoint} from '../lib/liquidityAutomaticHistoryGate.mjs';
const yaml=await readFile(new URL('../../../.github/workflows/glitch-liquidity-history-controlled-worker.yml',import.meta.url),'utf8');
function step(name){const start=yaml.indexOf(`      - name: ${name}\n`);assert.notEqual(start,-1);const end=yaml.indexOf('\n      - ',start+1);return yaml.slice(start,end<0?undefined:end);}
test('failure guards keep diagnostics independent of partial validation and normal checkpoint success-only',()=>{
 assert.match(step('Validate partial recovery evidence'),/if: failure\(\) && steps\.investigate\.outcome == 'failure'/);
 assert.match(step('Preserve isolated partial recovery'),/if: failure\(\) && steps\.recovery\.outcome == 'success'/);
 assert.match(step('Prepare sanitized failure diagnostic'),/if: failure\(\) && steps\.investigate\.outcome == 'failure'/);
 assert.doesNotMatch(step('Prepare sanitized failure diagnostic'),/steps\.recovery/);
 assert.match(step('Preserve failure diagnostic only'),/if: failure\(\) && steps\.diagnostics\.outcome == 'success'/);
 assert.match(step('Preserve validated checkpoint'),/&& success\(\)/);
 assert.match(step('Preserve isolated partial recovery'),/name: liquidity-history-partial-\$\{\{ github.run_id \}\}/);
 assert.match(step('Preserve isolated partial recovery'),/path: liquidity-history-partial-recovery.json/);
 assert.match(step('Preserve failure diagnostic only'),/path: liquidity-history-failure-diagnostic.json/);
 const discovery=/^liquidity-(reconciled|history)-[0-9]+$/;
 assert.ok(yaml.includes(discovery.source));
 for(const name of ['liquidity-history-partial-123','liquidity-history-failure-123'])assert.equal(discovery.test(name),false);
 assert.equal(discovery.test('liquidity-history-123'),true);
});
const pool='6e3jZLtf4tQbWZm3f7A66jF8tfZn6MRQVrbDFgcNWarA',a='1'.repeat(64),b='2'.repeat(64),c='3'.repeat(64);
const seed={schemaVersion:1,pool,before:a,seen:[a],events:[],pages:1,pendingSignatures:[],pendingSignatureCount:0,unresolvedReasons:{},errors:[],complete:false,historyCoverageVerified:false,authorizationVerified:false,withdrawalVerified:false,finalScore:null,classification:'AMOUNT_RECONCILED_AUTHORIZATION_PENDING',requestCount:60,stopReason:'CHECKPOINTED',reconciliation:{reconciliationStatus:'PENDING_SIGNATURES_RECONCILED_HISTORY_UNVERIFIED',originalPendingSignatureCount:2,originalStopReason:'RETRIEVAL_INCOMPLETE',sourceDigest:'a'.repeat(64),replayDigest:'b'.repeat(64),originalSeen:32,recoveredPending:2,verifiedDistinct:34,candidateCount:0,historyExhausted:false}};
for(const advanced of [false,true])test(`offline investigator failure: ${advanced?'advanced cursor rejected but diagnostic preserved':'same-page sanitized partial preserved'}`,async()=>{
 const dir=await mkdtemp(join(tmpdir(),'partial-worker-integration-'));
 try{
  const prior=join(dir,'prior.json'),raw=join(dir,'liquidity-history-evidence.json'),out=join(dir,'liquidity-history-partial-recovery.json'),diagnostic=join(dir,'liquidity-history-failure-diagnostic.json'),mock=join(dir,'mock.mjs');
  await writeFile(prior,JSON.stringify(seed));
  // All RPC methods are intercepted in-process. No network or credentials are used.
  await writeFile(mock,`let pages=0;globalThis.fetch=async(_url,options)=>{const {method,params}=JSON.parse(options.body);let result;if(method==='getSignaturesForAddress'){pages++;result=${advanced}? (pages===1?[{signature:'${b}',slot:2}]:[{signature:'${c}',slot:3}]):[{signature:'${b}',slot:2},{signature:'${c}',slot:3}];}else if(method==='getTransaction'&&params[0]==='${b}'){result={slot:2,meta:{err:null,innerInstructions:[]},transaction:{message:{instructions:[],accountKeys:[]}}};}else if(method==='getTransaction'&&params[0]==='${c}'){return {ok:true,json:async()=>({error:{code:-32000,message:'SYNTHETIC_PROVIDER_SECRET'}})};}else throw Error('UNEXPECTED_OFFLINE_METHOD');return {ok:true,json:async()=>({result})};};`);
  const env={...process.env,GLITCH_LIQUIDITY_POOL:pool,HELIUS_RPC_URL:'https://offline.invalid',ALCHEMY_RPC_URL:'',GLITCH_HISTORY_BUDGET:'8',GLITCH_HISTORY_PAGE_SIZE:'25',GLITCH_HISTORY_CHECKPOINT:prior,GLITCH_HISTORY_OUTPUT:raw};
  const run=(script,args=[],imports=[])=>spawnSync(process.execPath,[...imports,`scripts/${script}`,...args],{cwd:new URL('..',import.meta.url),encoding:'utf8',env});
  const investigation=run('liquidity-historical-investigator.mjs',[],['--import',mock]);assert.equal(investigation.status,1,investigation.stderr);
  const rawText=await readFile(raw,'utf8');assert.ok(rawText.includes('SYNTHETIC_PROVIDER_SECRET'));const partial=JSON.parse(rawText);assert.deepEqual(partial.seen,[a,b]);assert.deepEqual(partial.pendingSignatures,[c]);assert.equal(partial.pendingSignatureCount,1);
  const recovery=run('liquidity-prepare-partial-recovery.mjs',[prior,raw,out]);
  if(advanced){assert.notEqual(recovery.status,0);assert.match(recovery.stderr,/PARTIAL_RECOVERY_CURSOR_ADVANCED/);await assert.rejects(access(out));}
  else{assert.equal(recovery.status,0,recovery.stderr);const text=await readFile(out,'utf8'),safe=JSON.parse(text);assert.equal(text.includes('SYNTHETIC_PROVIDER_SECRET'),false);assert.deepEqual(safe.seen,[a,b]);assert.deepEqual(safe.pendingSignatures,[c]);assert.deepEqual(safe.reconciliation,seed.reconciliation);assert.equal(safe.before,seed.before);assert.equal(safe.finalScore,null);assert.equal(safe.authorizationVerified,false);assert.equal(safe.historyCoverageVerified,false);assert.equal(assessAutomaticHistoryCheckpoint(safe,pool).action,'PAUSE_UNRESOLVED_SIGNATURES');}
  // Model failure() diagnostic step after either recovery outcome, not a GitHub upload.
  const saved=run('liquidity-preserve-failure-diagnostic.mjs',[raw,diagnostic]);assert.equal(saved.status,0,saved.stderr);const text=await readFile(diagnostic,'utf8');assert.equal(text.includes('SYNTHETIC_PROVIDER_SECRET'),false);assert.equal(JSON.parse(text).continuationEligible,false);assert.deepEqual(JSON.parse(text).pendingSignatures,[c]);
 }finally{await rm(dir,{recursive:true,force:true});}
});
