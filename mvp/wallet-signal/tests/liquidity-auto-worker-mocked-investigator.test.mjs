import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const script=new URL('../scripts/liquidity-historical-investigator.mjs',import.meta.url).pathname;
const pool='6e3jZLtf4tQbWZm3f7A66jF8tfZn6MRQVrbDFgcNWarA';
async function runMock(response,budget='60'){
 const dir=await mkdtemp(join(tmpdir(),'lq08-mock-'));
 const mock=join(dir,'mock.mjs'),output=join(dir,'result.json');
 await writeFile(mock,`globalThis.fetch=async()=>({ok:true,json:async()=>({result:${JSON.stringify(response)}})});`);
 const proc=spawnSync(process.execPath,['--import',mock,script],{encoding:'utf8',env:{...process.env,GLITCH_LIQUIDITY_POOL:pool,HELIUS_RPC_URL:'https://offline.invalid',ALCHEMY_RPC_URL:'',GLITCH_HISTORY_BUDGET:budget,GLITCH_HISTORY_OUTPUT:output}});
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

test('60 RPC request ceiling under mocked transaction pagination',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'lq08-budget-'));
 try{
  const mock=join(dir,'mock.mjs'),output=join(dir,'result.json');
  const sig='2'.repeat(64);
  await writeFile(mock,`let count=0;globalThis.fetch=async(_url,opts)=>{count++;const req=JSON.parse(opts.body);const result=req.method==='getSignaturesForAddress'?[{signature:'${sig}',slot:123}]:null;return {ok:true,json:async()=>({result})};};process.on('exit',()=>console.log('MOCK_RPC_REQUESTS='+count));`);
  const proc=spawnSync(process.execPath,['--import',mock,script],{encoding:'utf8',env:{...process.env,GLITCH_LIQUIDITY_POOL:pool,HELIUS_RPC_URL:'https://offline.invalid',ALCHEMY_RPC_URL:'',GLITCH_HISTORY_BUDGET:'60',GLITCH_HISTORY_OUTPUT:output}});
  const state=JSON.parse(await readFile(output,'utf8'));
  const count=Number(proc.stdout.match(/MOCK_RPC_REQUESTS=(\d+)/)?.[1]);
  assert.ok(count>0&&count<=60);
  assert.equal(state.requestCount,count);
  assert.equal(state.complete,false);assert.equal(state.historyCoverageVerified,false);
  assert.equal(state.finalScore,null);assert.equal(state.authorizationVerified,false);
 }finally{await rm(dir,{recursive:true,force:true});}
});
