import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const script=fileURLToPath(new URL('../scripts/verify-historical-global-evidence-local.mjs',import.meta.url));
function run(payload){
 const dir=mkdtempSync(join(tmpdir(),'glitch-global-negative-'));
 try{
  const file=join(dir,'response.json');
  writeFileSync(file,JSON.stringify(payload));
  return spawnSync(process.execPath,[script,file],{encoding:'utf8',env:{...process.env,GLITCH_RESTRICTED_REPORT:''}});
 }finally{rmSync(dir,{recursive:true,force:true});}
}
const slot=442809233;
const account=data=>({result:{context:{slot},value:{data:[data,'base64']}}});
test('rejects RPC errors',()=>{const r=run({error:{code:-32000,message:'unavailable'}});assert.notEqual(r.status,0);assert.match(r.stderr,/HISTORICAL_CONTEXT_UNVERIFIED/);});
test('rejects wrong historical context slot',()=>{const x=account(Buffer.alloc(1045).toString('base64'));x.result.context.slot++;const r=run(x);assert.notEqual(r.status,0);assert.match(r.stderr,/HISTORICAL_CONTEXT_UNVERIFIED/);});
test('rejects missing account data',()=>{const r=run({result:{context:{slot},value:null}});assert.notEqual(r.status,0);assert.match(r.stderr,/ACCOUNT_DATA_UNAVAILABLE/);});
test('rejects wrong length',()=>{const r=run(account(Buffer.alloc(10).toString('base64')));assert.notEqual(r.status,0);assert.match(r.stderr,/ACCOUNT_LENGTH_MISMATCH/);});
test('rejects 1045 bytes with incorrect digest',()=>{const r=run(account(Buffer.alloc(1045).toString('base64')));assert.notEqual(r.status,0);assert.match(r.stderr,/HISTORICAL_HASH_MISMATCH/);assert.doesNotMatch(r.stdout,/CANDIDATE_DECODED_UNVERIFIED/);});
