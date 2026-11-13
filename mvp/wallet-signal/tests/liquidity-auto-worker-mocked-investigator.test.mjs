import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {openSync,closeSync,readFileSync} from 'node:fs';
const script=new URL('../scripts/liquidity-historical-investigator.mjs',import.meta.url).pathname;
const pool='6e3jZLtf4tQbWZm3f7A66jF8tfZn6MRQVrbDFgcNWarA';
function runWorker(mock,env,dir){
 // File-backed output avoids restricted sandboxes rejecting the socket pairs
 // used by spawnSync's default pipes. Keep genuine spawn failures explicit.
 const stdoutPath=join(dir,'stdout'),stderrPath=join(dir,'stderr');
 const stdout=openSync(stdoutPath,'w'),stderr=openSync(stderrPath,'w');
 let proc;
 try{
  proc=spawnSync(process.execPath,['--import',mock,script],{env:{...process.env,GLITCH_HISTORY_CHECKPOINT:'',GLITCH_HISTORY_PAGE_SIZE:'25',...env},stdio:['ignore',stdout,stderr],timeout:10000});
 }finally{closeSync(stdout);closeSync(stderr);}
 proc.stdout=readFileSync(stdoutPath,'utf8');proc.stderr=readFileSync(stderrPath,'utf8');
 assert.equal(proc.error,undefined);
 assert.equal(proc.signal,null);
 return proc;
}
function mockRequestCount(proc){
 const match=proc.stdout.match(/^MOCK_RPC_REQUESTS=(\d+)$/m);
 assert.ok(match,'mock request counter missing from worker stdout: '+proc.stdout);
 return Number(match[1]);
}
async function runMock(response,budget='60'){
 const dir=await mkdtemp(join(tmpdir(),'lq08-mock-'));
 const mock=join(dir,'mock.mjs'),output=join(dir,'result.json');
 await writeFile(mock,`globalThis.fetch=async()=>({ok:true,json:async()=>({result:${JSON.stringify(response)}})});`);
 const proc=runWorker(mock,{GLITCH_LIQUIDITY_POOL:pool,HELIUS_RPC_URL:'https://offline.invalid',ALCHEMY_RPC_URL:'',GLITCH_HISTORY_BUDGET:budget,GLITCH_HISTORY_OUTPUT:output},dir);
 let state=null;try{state=JSON.parse(await readFile(output,'utf8'));}catch{}
 await rm(dir,{recursive:true,force:true});return {proc,state};
}
test('empty history proves exhaustion without score promotion',async()=>{
 const {proc,state}=await runMock([]);
 assert.equal(proc.status,0);assert.equal(state.complete,true);assert.equal(state.historyCoverageVerified,true);
 assert.equal(state.finalScore,null);assert.equal(state.authorizationVerified,false);assert.equal(state.withdrawalVerified,false);
 assert.equal(state.requestCount,1);
});
test('invalid signature page fails closed without a resumable history claim',async()=>{
 const {proc,state}=await runMock([{signature:'not-a-real-signature',slot:'invalid'}]);
 assert.notEqual(proc.status,0);assert.equal(state.complete,false);assert.equal(state.historyCoverageVerified,false);
 assert.equal(state.finalScore,null);assert.ok(state.errors.length>0);
});
test('invalid RPC budget rejects configuration before fetch',async()=>{
 const {proc,state}=await runMock([],'1');
 assert.notEqual(proc.status,0);assert.equal(state,null);
});

test('unavailable transaction stops after two requests without advancing the cursor',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'lq08-budget-'));
 try{
  const mock=join(dir,'mock.mjs'),output=join(dir,'result.json');
  const sig='2'.repeat(64);
  await writeFile(mock,`let count=0;globalThis.fetch=async(_url,opts)=>{count++;const req=JSON.parse(opts.body);const result=req.method==='getSignaturesForAddress'?[{signature:'${sig}',slot:123}]:null;return {ok:true,json:async()=>({result})};};process.on('exit',()=>console.log('MOCK_RPC_REQUESTS='+count));`);
  const proc=runWorker(mock,{GLITCH_LIQUIDITY_POOL:pool,HELIUS_RPC_URL:'https://offline.invalid',ALCHEMY_RPC_URL:'',GLITCH_HISTORY_BUDGET:'60',GLITCH_HISTORY_OUTPUT:output},dir);
  const state=JSON.parse(await readFile(output,'utf8'));
  const count=mockRequestCount(proc);
  assert.equal(proc.status,1);assert.equal(count,2);
  assert.equal(state.before,null);assert.deepEqual(state.pendingSignatures,[sig]);
  assert.equal(state.stopReason,'RETRIEVAL_INCOMPLETE');
  assert.equal(state.requestCount,count);
  assert.equal(state.complete,false);assert.equal(state.historyCoverageVerified,false);
  assert.equal(state.finalScore,null);assert.equal(state.authorizationVerified,false);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('primary failure and fallback requests share the same 60-call ceiling',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'lq08-fallback-'));
 try{
  const mock=join(dir,'mock.mjs'),output=join(dir,'result.json'),sig='3'.repeat(64);
  await writeFile(mock,`let count=0;globalThis.fetch=async(url,opts)=>{count++;const req=JSON.parse(opts.body);if(req.method==='getSignaturesForAddress')return {ok:true,json:async()=>({result:[{signature:'${sig}',slot:123}]})};if(url.includes('primary'))return {ok:false,status:500};return {ok:true,json:async()=>({result:null})};};process.on('exit',()=>console.log('MOCK_RPC_REQUESTS='+count));`);
  const proc=runWorker(mock,{GLITCH_LIQUIDITY_POOL:pool,HELIUS_RPC_URL:'https://primary.invalid',ALCHEMY_RPC_URL:'https://fallback.invalid',GLITCH_HISTORY_BUDGET:'60',GLITCH_HISTORY_OUTPUT:output},dir);
  const state=JSON.parse(await readFile(output,'utf8')),count=mockRequestCount(proc);
  assert.equal(proc.status,1);
  assert.equal(state.before,null);assert.equal(state.stopReason,'RETRIEVAL_INCOMPLETE');
  assert.equal(count,3);assert.equal(state.requestCount,count);
  assert.equal(state.complete,false);assert.equal(state.historyCoverageVerified,false);assert.equal(state.finalScore,null);
  assert.ok(state.pendingSignatures.length>0);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('successful mocked pagination stops at the shared 60-request budget',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'lq08-ceiling-'));
 try{
  const mock=join(dir,'mock.mjs'),output=join(dir,'result.json');
  await writeFile(mock,`let count=0,signatureIndex=0;const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
globalThis.fetch=async(_url,opts)=>{
 count++;if(count>60)throw Error('MOCK_BUDGET_EXCEEDED');
 const req=JSON.parse(opts.body);
 const result=req.method==='getSignaturesForAddress'
  ?Array.from({length:req.params[1].limit},()=>{const n=signatureIndex++;return {signature:'2'.repeat(62)+alphabet[Math.floor(n/58)]+alphabet[n%58],slot:123};})
  :{slot:123,transaction:{message:{instructions:[]}},meta:{innerInstructions:[]}};
 return {ok:true,json:async()=>({result})};
};process.on('exit',()=>console.log('MOCK_RPC_REQUESTS='+count));`);
  const proc=runWorker(mock,{GLITCH_LIQUIDITY_POOL:pool,HELIUS_RPC_URL:'https://offline.invalid',ALCHEMY_RPC_URL:'',GLITCH_HISTORY_BUDGET:'60',GLITCH_HISTORY_OUTPUT:output},dir);
  const state=JSON.parse(await readFile(output,'utf8')),count=mockRequestCount(proc);
  assert.equal(proc.status,0);
  assert.equal(count,60);assert.equal(state.requestCount,count);
  assert.equal(state.stopReason,'REQUEST_BUDGET_EXHAUSTED');
  assert.equal(state.pages,2);assert.equal(state.seen.length,57);
  assert.equal(state.complete,false);assert.equal(state.historyCoverageVerified,false);
  assert.equal(state.finalScore,null);assert.equal(state.authorizationVerified,false);assert.equal(state.withdrawalVerified,false);
 }finally{await rm(dir,{recursive:true,force:true});}
});
