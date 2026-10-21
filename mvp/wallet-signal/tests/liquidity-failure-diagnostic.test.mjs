import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {summarizeLiquidityFailure} from '../lib/liquidityFailureDiagnostic.mjs';
import {validateHistoryCheckpoint} from '../lib/liquidityHistoricalDecoder.mjs';
const pool='6e3jZLtf4tQbWZm3f7A66jF8tfZn6MRQVrbDFgcNWarA',sig='2'.repeat(88);
const yaml=await readFile(new URL('../../../.github/workflows/glitch-liquidity-history-controlled-worker.yml',import.meta.url),'utf8');
test('diagnostic allowlist excludes synthetic secrets and cannot become checkpoint',()=>{
 const secret='SYNTHETIC_SECRET_DO_NOT_UPLOAD';
 assert.throws(()=>summarizeLiquidityFailure(secret),/^Error: INVALID_DIAGNOSTIC_SOURCE$/);
 const raw=JSON.stringify({pool,before:sig,seen:[sig,secret],pendingSignatures:[sig],requestCount:3,events:[{rawInstruction:secret}],errors:[{stage:'transaction',signature:sig,message:`https://rpc.invalid/?api-key=${secret}`},{stage:secret,reason:secret,signature:secret,expectedSlot:secret}],environment:{HELIUS_RPC_URL:secret},authorizationVerified:true,finalScore:100});
 const d=summarizeLiquidityFailure(raw);
 assert.ok(!JSON.stringify(d).includes(secret));assert.equal(d.continuationEligible,false);assert.equal(d.authorizationVerified,false);assert.equal(d.finalScore,null);
 assert.deepEqual(d.completedSignatures,[sig]);assert.equal(d.cursor,sig);assert.equal(d.candidateEventCount,1);assert.equal(d.errors[1].stage,'unknown');
 assert.throws(()=>validateHistoryCheckpoint(d,pool),/INVALID_HISTORY_CHECKPOINT/);
 assert.ok(yaml.includes('^liquidity-(reconciled|history)-[0-9]+$'));
 const discovery=/^liquidity-(reconciled|history)-[0-9]+$/;
 assert.equal(discovery.test('liquidity-history-failure-123'),false);assert.equal(discovery.test('liquidity-history-123'),true);
});
test('workflow preserves only sanitized failure output and keeps continuation success-only',()=>{
 assert.match(yaml,/id: investigate/);
 assert.match(yaml,/if: failure\(\) && steps\.investigate\.outcome == 'failure'/);
 assert.match(yaml,/if: failure\(\) && steps\.diagnostics\.outcome == 'success'/);
 assert.match(yaml,/name: liquidity-history-failure-\$\{\{ github.run_id \}\}/);
 assert.match(yaml,/path: liquidity-history-failure-diagnostic.json/);
 assert.match(yaml,/name: Preserve validated checkpoint\n        if: steps.select.outputs.action == 'CONTINUE_BOUNDED' && success\(\)/);
});
test('offline investigator failure writes partial state; diagnostic preserves safe progress',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'liquidity-failure-'));
 try{
  const mock=join(dir,'mock.mjs'),out=join(dir,'partial.json'),diagnostic=join(dir,'diagnostic.json');
  await writeFile(mock,`let calls=0;globalThis.fetch=async()=>({ok:true,json:async()=>++calls===1?{result:[{signature:'${sig}',slot:1}]}:{error:{code:-32000,message:'SYNTHETIC_PROVIDER_SECRET'}}});`);
  const run=spawnSync(process.execPath,['--import',mock,'scripts/liquidity-historical-investigator.mjs'],{cwd:new URL('..',import.meta.url),encoding:'utf8',env:{...process.env,HELIUS_RPC_URL:'https://offline.invalid',ALCHEMY_RPC_URL:'',GLITCH_LIQUIDITY_POOL:pool,GLITCH_HISTORY_BUDGET:'3',GLITCH_HISTORY_OUTPUT:out,GLITCH_HISTORY_CHECKPOINT:''}});
  assert.equal(run.status,1,run.stderr);const partial=JSON.parse(await readFile(out,'utf8'));assert.deepEqual(partial.pendingSignatures,[sig]);assert.equal(partial.stopReason,'RETRIEVAL_INCOMPLETE');
  const saved=spawnSync(process.execPath,['scripts/liquidity-preserve-failure-diagnostic.mjs',out,diagnostic],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
  assert.equal(saved.status,0,saved.stderr);const text=await readFile(diagnostic,'utf8');assert.ok(!text.includes('SYNTHETIC_PROVIDER_SECRET'));assert.deepEqual(JSON.parse(text).pendingSignatures,[sig]);assert.equal(JSON.parse(text).continuationEligible,false);
 }finally{await rm(dir,{recursive:true,force:true});}
});
