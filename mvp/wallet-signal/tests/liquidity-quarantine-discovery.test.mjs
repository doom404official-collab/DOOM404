import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,copyFile,mkdir,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {describeLiquidityPublication} from '../docs/proposals/liquidity-inactive/sidecars.mjs';
const fixtures=new URL('./fixtures/liquidity-discovery/',import.meta.url);
const pattern=new RegExp((await readFile(new URL('discovery-pattern.txt',fixtures),'utf8')).trim());
const pool='1'.repeat(32),a='1'.repeat(64),b='2'.repeat(64);
const prior={schemaVersion:1,pool,before:a,seen:[a],events:[],pendingSignatures:[],complete:false,historyCoverageVerified:false,authorizationVerified:false,withdrawalVerified:false,finalScore:null,classification:'AMOUNT_RECONCILED_AUTHORIZATION_PENDING',reconciliation:{verifiedDistinct:34,recoveredPending:2,sourceDigest:'a'.repeat(64)},stopReason:'CHECKPOINTED'};
test('actual discovery validator and selection CLI cannot select unreviewed success or sidecars',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'lq-discovery-'));
 try{
  await mkdir(join(dir,'scripts'));await symlink(fileURLToPath(new URL('../lib',import.meta.url)),join(dir,'lib'),'dir');
  for(const file of ['liquidity-validate-artifact-discovery.mjs','liquidity-select-checkpoint.mjs'])await copyFile(new URL(file,fixtures),join(dir,'scripts',file));
  const old=join(dir,'old.json'),next=join(dir,'next.json');await writeFile(old,JSON.stringify(prior));await writeFile(next,JSON.stringify({...prior,seen:[a,b]}));
  const record=(run,name,path)=>({runId:run,artifactName:name,prefix:name.slice(0,name.lastIndexOf('-')),path,branch:'feature/glitch-liquidity-evidence-worker',conclusion:'success'});
  const legacy=record(100,'liquidity-history-100',old);
  async function select(records){
   await writeFile(join(dir,'records.json'),JSON.stringify(records));
   const valid=spawnSync(process.execPath,[join(dir,'scripts/liquidity-validate-artifact-discovery.mjs'),join(dir,'records.json'),join(dir,'manifest.json')],{encoding:'utf8'});
   if(valid.status!==0)return {valid};
   const selected=spawnSync(process.execPath,[join(dir,'scripts/liquidity-select-checkpoint.mjs'),join(dir,'manifest.json'),join(dir,'selected.json')],{encoding:'utf8',env:{PATH:process.env.PATH,GLITCH_LIQUIDITY_POOL:pool}});
   assert.equal(selected.status,0,selected.stderr);return {valid,receipt:JSON.parse(selected.stdout)};
  }
  // Reproduce the gap: these consumers do not require an admission receipt.
  assert.equal((await select([legacy,record(101,'liquidity-history-101',next)])).receipt.sourceRunId,101);
  for(const sidecar of [false,true]){
   const files=[{name:'liquidity-history-evidence.json',bytes:Buffer.from(JSON.stringify({...prior,seen:[a,b]}))}];
   if(sidecar)files.push({name:'liquidity-history-evidence.json.lock',bytes:Buffer.from('lock')});
   const bundle=describeLiquidityPublication({run:'101',conclusion:'success',files});
   assert.equal(bundle.artifactName,'liquidity-quarantine-101');assert.equal('sourcePreserved' in bundle,false);
   const unreviewed=record(101,bundle.artifactName,next);
   assert.equal(pattern.test(unreviewed.artifactName),false);
   assert.equal((await select([legacy,unreviewed].filter(r=>pattern.test(r.artifactName)))).receipt.sourceRunId,100);
   assert.match((await select([unreviewed])).valid.stderr,/UNTRUSTED_ARTIFACT_SOURCE/);
  }
 }finally{await rm(dir,{recursive:true,force:true});}
});
