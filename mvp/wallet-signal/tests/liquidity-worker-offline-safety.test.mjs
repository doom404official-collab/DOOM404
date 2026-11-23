import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {retryLiquidityRateLimit} from '../lib/liquidityHistoricalRateLimit.mjs';
import {retrieveHistoricalTransaction} from '../lib/liquidityHistoricalTransactionCompat.mjs';
const v1=JSON.parse(await readFile(new URL('./fixtures/liquidity-parsed-v1/transaction.json',import.meta.url),'utf8'));
const script=new URL('../scripts/liquidity-historical-investigator.mjs',import.meta.url).pathname;
const pool='6e3jZLtf4tQbWZm3f7A66jF8tfZn6MRQVrbDFgcNWarA';
test('bounded retries stop after configured maximum',async()=>{
 let count=0;
 await assert.rejects(retryLiquidityRateLimit(async()=>{count++;throw Error('RPC_HTTP_429');},{sleep:async()=>{},maxRetries:2}),/429/);
 assert.equal(count,3);
});
test('version fallback only on explicit incompatibility',async()=>{
 let versions=[];
 const result=await retrieveHistoricalTransaction(async(_url,_method,params)=>{versions.push(params[1].maxSupportedTransactionVersion);if(versions.length===1)throw Error('unsupported transaction version');return v1;},'offline',v1.transaction.signatures[0]);
 assert.deepEqual(versions,[0,1]);assert.deepEqual(result,v1);
 let attempts=0;
 await assert.rejects(retrieveHistoricalTransaction(async()=>{attempts++;throw Error('RPC_HTTP_429');},'offline','1'.repeat(64)),/429/);
 assert.equal(attempts,1);
});
test('versionless and malformed v1 fallbacks remain unresolved',async()=>{
 for(const tx of [{slot:1},{...v1,version:undefined},{...v1,transaction:{}}]){
  const versions=[];
  await assert.rejects(retrieveHistoricalTransaction(async(_url,_method,params)=>{
   versions.push(params[1].maxSupportedTransactionVersion);
   if(versions.length===1)throw Error('RPC_-32015');return tx;
  },'offline',v1.transaction.signatures[0]),/TRANSACTION_V1_FALLBACK_UNRESOLVED/);
  assert.deepEqual(versions,[0,1]);
 }
});
test('investigator rejects invalid configuration before any network request',()=>{
 const run=spawnSync(process.execPath,[script],{encoding:'utf8',env:{...process.env,GLITCH_LIQUIDITY_POOL:pool,HELIUS_RPC_URL:'http://invalid',GLITCH_HISTORY_BUDGET:'60'}});
 assert.notEqual(run.status,0);assert.match(run.stderr,/INVALID_HISTORY_CONFIGURATION/);
});
test('investigator never overwrites pre-existing evidence',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'liquidity-offline-worker-'));
 try{
  const output=join(dir,'evidence.json'),marker='DO_NOT_OVERWRITE_EVIDENCE';
  await writeFile(output,marker);
  const mock=join(dir,'mock.mjs');
  await writeFile(mock,"globalThis.fetch=async()=>({ok:true,json:async()=>({result:[]})});");
  const run=spawnSync(process.execPath,['--import',mock,script],{encoding:'utf8',env:{...process.env,GLITCH_LIQUIDITY_POOL:pool,HELIUS_RPC_URL:'https://offline.invalid',ALCHEMY_RPC_URL:'',GLITCH_HISTORY_BUDGET:'2',GLITCH_HISTORY_OUTPUT:output}});
  assert.notEqual(run.status,0);
  assert.equal(await readFile(output,'utf8'),marker);
 }finally{await rm(dir,{recursive:true,force:true});}
});
