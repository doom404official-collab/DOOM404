import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const script=new URL('../scripts/liquidity-historical-investigator.mjs',import.meta.url).pathname;
const pool='6e3jZLtf4tQbWZm3f7A66jF8tfZn6MRQVrbDFgcNWarA';
const prior={schemaVersion:1,pool,before:'1'.repeat(64),seen:['1'.repeat(64)],events:[],errors:[],pages:2,requestCount:10,pendingSignatures:[],complete:false,historyCoverageVerified:false,authorizationVerified:false,withdrawalVerified:false,finalScore:null,classification:'AMOUNT_RECONCILED_AUTHORIZATION_PENDING',stopReason:'CHECKPOINTED'};
async function sourceFixture(dir){const input=join(dir,'source.json');await writeFile(input,JSON.stringify(prior));return input;}
async function assertSource(input){assert.deepEqual(JSON.parse(await readFile(input,'utf8')),prior);}
async function runMock(response,budget='60'){
 const dir=await mkdtemp(join(tmpdir(),'lq08-mock-'));
 const mock=join(dir,'mock.mjs'),output=join(dir,'result.json'),input=await sourceFixture(dir);
 await writeFile(mock,`globalThis.fetch=async(_url,opts)=>({ok:true,json:async()=>({jsonrpc:'2.0',id:JSON.parse(opts.body).id,result:${JSON.stringify(response)}})});`);
 const proc=spawnSync(process.execPath,['--import',mock,script],{encoding:'utf8',env:{...process.env,GLITCH_LIQUIDITY_POOL:pool,HELIUS_RPC_URL:'https://offline.invalid',ALCHEMY_RPC_URL:'',GLITCH_HISTORY_BUDGET:budget,GLITCH_HISTORY_OUTPUT:output,GLITCH_HISTORY_CHECKPOINT:input}});
 let state=null;try{state=JSON.parse(await readFile(output,'utf8'));}catch{}
 await assertSource(input);await rm(dir,{recursive:true,force:true});return {proc,state};
}
test('synthetic continuation empty follow-up marks exhaustion without score promotion',async()=>{
 const {proc,state}=await runMock([]);
 assert.equal(proc.status,0);assert.equal(state.complete,true);assert.equal(state.historyCoverageVerified,true);
 assert.equal(state.finalScore,null);assert.equal(state.authorizationVerified,false);assert.equal(state.withdrawalVerified,false);
 assert.equal(state.requestCount,prior.requestCount+1);assert.deepEqual(state.seen,prior.seen);
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

test('60 RPC request ceiling under mocked transaction pagination',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'lq08-budget-'));
 try{
  const mock=join(dir,'mock.mjs'),output=join(dir,'result.json'),input=await sourceFixture(dir);
  const sig='2'.repeat(64);
  await writeFile(mock,`let count=0,page=0;globalThis.fetch=async(_url,opts)=>{count++;const req=JSON.parse(opts.body);const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';const result=req.method==='getSignaturesForAddress'?Array.from({length:25},(_,i)=>({signature:alphabet[page]+alphabet[i]+'2'.repeat(62),slot:123})):{slot:123,transaction:{signatures:[req.params[0]],message:{instructions:[]}},meta:{err:null,innerInstructions:[]}};if(req.method==='getSignaturesForAddress')page++;return {ok:true,json:async()=>({jsonrpc:'2.0',id:req.id,result})};};process.on('exit',()=>console.log('MOCK_RPC_REQUESTS='+count));`);
  const proc=spawnSync(process.execPath,['--import',mock,script],{encoding:'utf8',env:{...process.env,GLITCH_LIQUIDITY_POOL:pool,HELIUS_RPC_URL:'https://offline.invalid',ALCHEMY_RPC_URL:'',GLITCH_HISTORY_BUDGET:'60',GLITCH_HISTORY_OUTPUT:output,GLITCH_HISTORY_CHECKPOINT:input}});
  const state=JSON.parse(await readFile(output,'utf8'));
  const count=Number(proc.stdout.match(/MOCK_RPC_REQUESTS=(\d+)/)?.[1]);
  assert.equal(count,60);
  assert.equal(state.requestCount,prior.requestCount+count);await assertSource(input);assert.ok(state.seen.includes(prior.seen[0]));
  assert.equal(state.complete,false);assert.equal(state.historyCoverageVerified,false);
  assert.equal(state.finalScore,null);assert.equal(state.authorizationVerified,false);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('primary failure and fallback requests share the same 60-call ceiling',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'lq08-fallback-'));
 try{
  const mock=join(dir,'mock.mjs'),output=join(dir,'result.json'),sig='3'.repeat(64),input=await sourceFixture(dir);
  await writeFile(mock,`let count=0;globalThis.fetch=async(url,opts)=>{count++;const req=JSON.parse(opts.body);if(req.method==='getSignaturesForAddress')return {ok:true,json:async()=>({jsonrpc:'2.0',id:req.id,result:[{signature:'${sig}',slot:123}]})};if(url.includes('primary'))return {ok:false,status:500};return {ok:true,json:async()=>({jsonrpc:'2.0',id:req.id,result:null})};};process.on('exit',()=>console.log('MOCK_RPC_REQUESTS='+count));`);
  const proc=spawnSync(process.execPath,['--import',mock,script],{encoding:'utf8',env:{...process.env,GLITCH_LIQUIDITY_POOL:pool,HELIUS_RPC_URL:'https://primary.invalid',ALCHEMY_RPC_URL:'https://fallback.invalid',GLITCH_HISTORY_BUDGET:'60',GLITCH_HISTORY_OUTPUT:output,GLITCH_HISTORY_CHECKPOINT:input}});
  const state=JSON.parse(await readFile(output,'utf8')),count=Number(proc.stdout.match(/MOCK_RPC_REQUESTS=(\d+)/)?.[1]);
  assert.notEqual(proc.status,0);
  assert.ok(count>=3&&count<=60);assert.equal(state.requestCount,prior.requestCount+count);await assertSource(input);assert.ok(state.seen.includes(prior.seen[0]));
  assert.equal(state.complete,false);assert.equal(state.historyCoverageVerified,false);assert.equal(state.finalScore,null);
  assert.ok(state.pendingSignatures.length>0);
 }finally{await rm(dir,{recursive:true,force:true});}
});
