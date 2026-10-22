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
const owner='6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
const capture={accountAddress:'4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf',requestedSlot:slot,method:'getAccountInfo'};
const account=data=>({capture:{...capture},result:{context:{slot},value:{owner,data:[data,'base64']}}});
test('rejects RPC errors',()=>{const r=run({capture:{...capture},error:{code:-32000,message:'unavailable'}});assert.notEqual(r.status,0);assert.match(r.stderr,/HISTORICAL_CONTEXT_UNVERIFIED/);});
test('rejects wrong historical context slot',()=>{const x=account(Buffer.alloc(1045).toString('base64'));x.result.context.slot++;const r=run(x);assert.notEqual(r.status,0);assert.match(r.stderr,/HISTORICAL_CONTEXT_UNVERIFIED/);});
test('rejects missing account data',()=>{const r=run({capture:{...capture},result:{context:{slot},value:null}});assert.notEqual(r.status,0);assert.match(r.stderr,/ACCOUNT_DATA_UNAVAILABLE/);});
test('rejects wrong length',()=>{const r=run(account(Buffer.alloc(10).toString('base64')));assert.notEqual(r.status,0);assert.match(r.stderr,/ACCOUNT_LENGTH_MISMATCH/);});
test('rejects 1045 bytes with incorrect digest',()=>{const r=run(account(Buffer.alloc(1045).toString('base64')));assert.notEqual(r.status,0);assert.match(r.stderr,/HISTORICAL_HASH_MISMATCH/);assert.doesNotMatch(r.stdout,/CANDIDATE_DECODED_UNVERIFIED/);});

test('rejects invalid base64 characters before hashing',()=>{const r=run(account('!'.repeat(1396)));assert.notEqual(r.status,0);assert.match(r.stderr,/ACCOUNT_BASE64_INVALID/);});
test('rejects noncanonical base64 before hashing',()=>{const r=run(account('Zh=='));assert.notEqual(r.status,0);assert.match(r.stderr,/ACCOUNT_BASE64_NONCANONICAL/);});
test('rejects missing base64 payload before hashing',()=>{const r=run(account(''));assert.notEqual(r.status,0);assert.match(r.stderr,/ACCOUNT_BASE64_INVALID/);});

test('rejects incorrect owning program before hashing',()=>{const x=account(Buffer.alloc(1045).toString('base64'));x.result.value.owner='11111111111111111111111111111111';const r=run(x);assert.notEqual(r.status,0);assert.match(r.stderr,/ACCOUNT_OWNER_MISMATCH/);});

test('rejects capture without requested account identity',()=>{const x=account(Buffer.alloc(1045).toString('base64'));delete x.capture;const r=run(x);assert.notEqual(r.status,0);assert.match(r.stderr,/CAPTURE_IDENTITY_UNVERIFIED/);});
test('rejects wrong capture account identity',()=>{const x=account(Buffer.alloc(1045).toString('base64'));x.capture.accountAddress='11111111111111111111111111111111';const r=run(x);assert.notEqual(r.status,0);assert.match(r.stderr,/CAPTURE_IDENTITY_UNVERIFIED/);});
