import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, symlink, link, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { reconcileLiquidityHistory } from '../lib/liquidityHistoricalReconciliation.mjs';
const hash = x => createHash('sha256').update(JSON.stringify(x)).digest('hex');
function fixture() {
 const pool='pool', classification='AMOUNT_RECONCILED_AUTHORIZATION_PENDING';
 const original={schemaVersion:1,pool,classification,seen:Array.from({length:32},(_,i)=>`s${i}`),pendingSignatures:['p1','p2'],events:[],complete:false};
 const tx=signature=>({signature,execution:'EXECUTION_SUCCEEDED_AUTHORIZATION_UNVERIFIED',candidates:[]});
 const base={pool,classification,authorizationVerified:false,finalScore:null,unresolved:[]};
 const replays=Array.from({length:4},(_,i)=>({...base,kind:'HISTORICAL_DECODER_REPLAY_EVIDENCE',sourceDigest:hash({pool,seen:original.seen,events:[],updatedAt:null}),transactions:original.seen.slice(i*8,i*8+8).map(tx)}));
 const recovery={...base,kind:'LIQUIDITY_PENDING_SIGNATURE_RECOVERY',sourceDigest:hash(original),transactions:original.pendingSignatures.map(tx)};
 return {original,replays,recovery,pool};
}
test('recovery must explicitly declare an empty unresolved array',()=>{
 for(const value of [undefined,null,{},'',0]) {
  const f=fixture();f.recovery.unresolved=value;
  assert.throws(()=>reconcileLiquidityHistory(f.original,f.replays,f.recovery,f.pool),/INVALID_PENDING_RECOVERY/);
 }
});
test('transaction candidates must be explicit arrays',()=>{
 for(const target of ['replay','recovery']) for(const value of [undefined,null,{},'']) {
  const f=fixture();(target==='replay'?f.replays[0]:f.recovery).transactions[0].candidates=value;
  assert.throws(()=>reconcileLiquidityHistory(f.original,f.replays,f.recovery,f.pool),/INVALID_TRANSACTION_CANDIDATES/);
 }
});
test('CLI never overwrites input evidence or an existing output, including aliases',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'liquidity-safety-'));
 try {
  const f=fixture(), inputs=[f.original,...f.replays,f.recovery];
  const paths=inputs.map((_,i)=>join(dir,`${i}.json`));
  await Promise.all(paths.map((p,i)=>writeFile(p,JSON.stringify(inputs[i]))));
  const existing=join(dir,'existing.json'), symbolic=join(dir,'symbolic.json'), hard=join(dir,'hard.json');
  await writeFile(existing,'KEEP'); await symlink(paths[0],symbolic); await link(paths[0],hard);
  const run=out=>spawnSync(process.execPath,[new URL('../scripts/liquidity-reconcile-history.mjs',import.meta.url).pathname,...paths,out],{encoding:'utf8'});
  for(const out of [...paths,join(dir,'.','0.json'),existing,symbolic,hard]) assert.notEqual(run(out).status,0,`must reject ${out}`);
  for(let i=0;i<paths.length;i++)assert.equal(await readFile(paths[i],'utf8'),JSON.stringify(inputs[i]));
  assert.equal(await readFile(existing,'utf8'),'KEEP');
  const output=join(dir,'new.json'); const result=run(output); assert.equal(result.status,0,result.stderr);
  const data=JSON.parse(await readFile(output,'utf8')); assert.equal(data.reconciliation.verifiedDistinct,34);assert.equal(data.complete,false);assert.equal(data.finalScore,null);
 } finally {await rm(dir,{recursive:true,force:true});}
});

test('reconciled checkpoint refreshes pending metadata without claiming history completion',()=>{
 const f=fixture();f.original.pendingSignatureCount=2;f.original.stopReason='RETRIEVAL_INCOMPLETE';
 f.recovery.sourceDigest=hash(f.original);
 const before=JSON.stringify(f.original);
 const result=reconcileLiquidityHistory(f.original,f.replays,f.recovery,f.pool);
 assert.deepEqual(result.pendingSignatures,[]);assert.equal(result.pendingSignatureCount,0);
 assert.equal(result.stopReason,'CHECKPOINTED');
 assert.equal(result.reconciliation.reconciliationStatus,'PENDING_SIGNATURES_RECONCILED_HISTORY_UNVERIFIED');
 assert.equal(result.reconciliation.originalPendingSignatureCount,2);
 assert.equal(result.reconciliation.originalStopReason,'RETRIEVAL_INCOMPLETE');
 assert.equal(result.complete,false);assert.equal(result.historyCoverageVerified,false);
 assert.equal(result.reconciliation.historyExhausted,false);assert.equal(result.authorizationVerified,false);assert.equal(result.finalScore,null);
 assert.equal(JSON.stringify(f.original),before);
});
