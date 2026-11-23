import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {validParsedLiquidityV1} from '../lib/liquidityParsedV1.mjs';
import {retrieveHistoricalTransaction} from '../lib/liquidityHistoricalTransactionCompat.mjs';
import {extractHistoricalTransactionCandidates,validateHistoryCheckpoint} from '../lib/liquidityHistoricalDecoder.mjs';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/liquidity-parsed-v1/transaction.json',import.meta.url)));
const sig=fixture.transaction.signatures[0],pool=fixture.transaction.message.accountKeys[1].pubkey;
const prior={schemaVersion:1,pool,before:'2'.repeat(64),seen:['2'.repeat(64)],events:[],errors:[],pages:2,requestCount:10,pendingSignatures:[],complete:false,historyCoverageVerified:false,authorizationVerified:false,withdrawalVerified:false,finalScore:null,classification:'AMOUNT_RECONCILED_AUTHORIZATION_PENDING',stopReason:'CHECKPOINTED'};
test('pinned synthetic v1 preserves identity and CPI positions without authorization',()=>{
 const tx=structuredClone(fixture);assert.equal(validParsedLiquidityV1(tx),true);
 const events=extractHistoricalTransactionCandidates(tx,sig,123,'synthetic',pool);
 assert.deepEqual(events.map(e=>[e.outerInstructionIndex,e.innerInstructionIndex]),[[0,null],[0,0]]);
 assert.ok(events.every(e=>e.authorizationVerified===false&&e.accountRolesVerified===false&&e.signerAuthorizationVerified===false));
 for(const k of Object.keys(tx.transaction.message.transactionConfig))tx.transaction.message.transactionConfig[k]=null;
 assert.equal(validParsedLiquidityV1(tx),true);
 const saved=JSON.stringify(prior);validateHistoryCheckpoint(prior,pool);assert.equal(JSON.stringify(prior),saved);
});
test('sanitized CLI rejection permits one v1 request; unrelated failure and second rejection never loop',async()=>{
 for(const message of ['RPC_-32015','RPC_-32602','RPC_HTTP_429']){
  const versions=[];const call=async(_u,_m,p)=>{versions.push(p[1].maxSupportedTransactionVersion);throw Error(message);};
  await assert.rejects(retrieveHistoricalTransaction(call,'https://offline.invalid',sig));
  assert.deepEqual(versions,message==='RPC_-32015'?[0,1]:[0]);
 }
});
test('legacy and v0 successful reads remain one request with unchanged candidate interpretation',async()=>{
 for(const version of ['legacy',0,undefined]){
  const tx=structuredClone(fixture);if(version===undefined)delete tx.version;else tx.version=version;
  delete tx.transaction.message.transactionConfig;
  let calls=0;
  assert.equal(await retrieveHistoricalTransaction(async()=>{calls++;return tx;},'https://offline.invalid',sig),tx);
  assert.equal(calls,1);assert.equal(extractHistoricalTransactionCandidates(tx,sig,123,'synthetic',pool).length,2);
 }
 const inconsistent=structuredClone(fixture);inconsistent.version=0;
 assert.throws(()=>extractHistoricalTransactionCandidates(inconsistent,sig,123,'synthetic',pool),/TRANSACTION_VERSION_UNSUPPORTED/);
});
test('sparse parsed arrays are not complete v1 evidence',()=>{
 for(const path of ['keys','outer','inner','accounts']){
  const tx=structuredClone(fixture),m=tx.transaction.message;
  if(path==='keys')delete m.accountKeys[1];
  if(path==='outer')delete m.instructions[0];
  if(path==='inner')delete tx.meta.innerInstructions[0];
  if(path==='accounts')delete m.instructions[0].accounts[0];
  assert.equal(validParsedLiquidityV1(tx),false);
 }
});
async function run(tx,budget=4){
 const dir=await mkdtemp(join(tmpdir(),'liquidity-v1-'));
 try{
  const source=join(dir,'source.json'),output=join(dir,'output.json'),mock=join(dir,'mock.mjs');
  await writeFile(source,JSON.stringify(prior));
  await writeFile(mock,`let calls=[];globalThis.fetch=async(_url,opts)=>{const q=JSON.parse(opts.body);calls.push([q.method,q.params[1]?.maxSupportedTransactionVersion??null]);let result;if(q.method==='getSignaturesForAddress')result=q.params[1].before==='${prior.before}'?[{signature:'${sig}',slot:123}]:[];else if(q.method==='getTransaction'){if(q.params[1].maxSupportedTransactionVersion===0)return {ok:true,json:async()=>({jsonrpc:'2.0',id:q.id,error:{code:-32015,message:'UNTRUSTED_PROVIDER_TEXT'}})};result=${JSON.stringify(tx)};}else throw Error('UNEXPECTED_METHOD');return {ok:true,json:async()=>({jsonrpc:'2.0',id:q.id,result})};};process.on('exit',()=>console.log('MOCK_CALLS='+JSON.stringify(calls)));`);
  const p=spawnSync(process.execPath,['--import',mock,new URL('../scripts/liquidity-historical-investigator.mjs',import.meta.url).pathname],{encoding:'utf8',timeout:10000,env:{PATH:process.env.PATH,GLITCH_LIQUIDITY_POOL:pool,HELIUS_RPC_URL:'https://offline.invalid',ALCHEMY_RPC_URL:'',GLITCH_HISTORY_BUDGET:String(budget),GLITCH_HISTORY_CHECKPOINT:source,GLITCH_HISTORY_OUTPUT:output}});
  assert.equal(p.error,undefined);assert.deepEqual(JSON.parse(await readFile(source,'utf8')),prior);
  const state=JSON.parse(await readFile(output,'utf8')),calls=JSON.parse(p.stdout.match(/MOCK_CALLS=(.*)/)[1]);
  assert.ok(!JSON.stringify(state).includes('UNTRUSTED_PROVIDER_TEXT'));
  assert.equal(state.authorizationVerified,false);assert.equal(state.withdrawalVerified,false);assert.equal(state.finalScore,null);
  return {state,calls,status:p.status};
 }finally{await rm(dir,{recursive:true,force:true});}
}
test('actual CLI sanitized rejection and supported v1 use existing budget before empty-page exhaustion',async()=>{
 const {state,calls,status}=await run(fixture);assert.equal(status,0);
 assert.deepEqual(calls,[['getSignaturesForAddress',null],['getTransaction',0],['getTransaction',1],['getSignaturesForAddress',null]]);
 assert.equal(state.requestCount,14);assert.equal(state.complete,true);assert.equal(state.pendingSignatures.length,0);assert.equal(state.events.length,2);
});
function replaceWithParsed(ix){delete ix.data;delete ix.accounts;ix.parsed={};}
test('CPI depth allows siblings, nesting and multi-frame returns, not completeness certification',()=>{
 const tx=structuredClone(fixture),ix=tx.meta.innerInstructions[0].instructions[0];
 tx.meta.innerInstructions[0].instructions=[2,3,4,2,2,3].map(stackHeight=>({...structuredClone(ix),stackHeight}));
 assert.equal(validParsedLiquidityV1(tx),true);
 // Empty/absent groups cannot establish whether an RPC provider omitted CPIs.
 tx.meta.innerInstructions=[];assert.equal(validParsedLiquidityV1(tx),true);
 assert.equal(extractHistoricalTransactionCandidates(tx,sig,123,'synthetic',pool).length,1);
 tx.meta.innerInstructions=[{index:0,instructions:[]}];assert.equal(validParsedLiquidityV1(tx),true);
 assert.equal(extractHistoricalTransactionCandidates(tx,sig,123,'synthetic',pool)[0].authorizationVerified,false);
});
const mutations={
 parsedPumpOuter:t=>replaceWithParsed(t.transaction.message.instructions[0]),
 parsedPumpCpi:t=>replaceWithParsed(t.meta.innerInstructions[0].instructions[0]),
 parsedPumpBoth:t=>{replaceWithParsed(t.transaction.message.instructions[0]);replaceWithParsed(t.meta.innerInstructions[0].instructions[0]);},
 missingPumpData:t=>delete t.meta.innerInstructions[0].instructions[0].data,
 missingPumpAccounts:t=>delete t.transaction.message.instructions[0].accounts,
 orphanDepth:t=>t.meta.innerInstructions[0].instructions[0].stackHeight=3,
 skippedDepth:t=>{const g=t.meta.innerInstructions[0];g.instructions.push({...structuredClone(g.instructions[0]),stackHeight:4});},
 omittedVersion:t=>delete t.version,wrongVersion:t=>t.version=0,
 wrongSignature:t=>t.transaction.signatures=['3'.repeat(64)],wrongSlot:t=>t.slot++,
 missingConfig:t=>delete t.transaction.message.transactionConfig,
 missingNullable:t=>delete t.transaction.message.transactionConfig.heapSize,
 unsafeNumber:t=>t.transaction.message.transactionConfig.priorityFee=Number.MAX_SAFE_INTEGER+1,
 malformedConfig:t=>t.transaction.message.transactionConfig.heapSize=-1,
 lookupKeys:t=>t.transaction.message.accountKeys[1].source='lookupTable',
 lookupDescriptor:t=>t.transaction.message.addressTableLookups=[],
 loadedAddresses:t=>t.meta.loadedAddresses={writable:[pool],readonly:[]},
 missingCpi:t=>delete t.meta.innerInstructions,
 duplicateCpi:t=>t.meta.innerInstructions.push(structuredClone(t.meta.innerInstructions[0])),
 orphanCpi:t=>t.meta.innerInstructions[0].index=1,
 foreignInstructionKey:t=>t.meta.innerInstructions[0].instructions[0].accounts=['4'.repeat(32)],
 contradictoryInstruction:t=>t.transaction.message.instructions[0].parsed={type:'set_coin_creator'},
 invalidAccount:t=>t.transaction.message.accountKeys[1].pubkey='bad'
};
for(const [name,mutate] of Object.entries(mutations))test('CLI preserves unresolved v1: '+name,async()=>{
 const tx=structuredClone(fixture);mutate(tx);const {state,calls,status}=await run(tx);
 assert.notEqual(status,0);assert.equal(calls.length,3);assert.equal(state.before,prior.before);assert.deepEqual(state.seen,prior.seen);assert.deepEqual(state.events,[]);assert.deepEqual(state.pendingSignatures,[sig]);assert.equal(state.complete,false);assert.equal(state.historyCoverageVerified,false);
});
test('fallback budget exhausted before dispatch preserves pending and cursor',async()=>{
 const {state,calls,status}=await run(fixture,2);assert.notEqual(status,0);assert.equal(calls.length,2);assert.equal(state.requestCount,12);assert.equal(state.before,prior.before);assert.deepEqual(state.seen,prior.seen);assert.deepEqual(state.pendingSignatures,[sig]);assert.equal(state.complete,false);assert.equal(state.historyCoverageVerified,false);
});

const memoIds=[
 'Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo',
 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr',
 'Memo4c2pN8afCj432Lb7RMVKi9PbQnnW7ewFFaV3oAH'
];
function withMemo(id){
 const tx=structuredClone(fixture);
 tx.transaction.message.accountKeys.push({pubkey:id,signer:false,writable:false,source:'transaction'});
 tx.transaction.message.instructions.push({programId:id,program:'spl-memo',parsed:'Synthetic memo: héllo',stackHeight:1});
 tx.meta.innerInstructions[0].instructions.push({programId:id,program:'spl-memo',parsed:'',stackHeight:2});
 return tx;
}
for(const id of memoIds)test('canonical Memo string preserves PumpSwap candidates: '+id,async()=>{
 const tx=withMemo(id);assert.equal(validParsedLiquidityV1(tx),true);
 const {state,calls,status}=await run(tx);assert.equal(status,0);assert.equal(calls.length,4);assert.equal(state.events.length,2);
 assert.deepEqual(state.events.map(e=>[e.outerInstructionIndex,e.innerInstructionIndex]),[[0,null],[0,0]]);
});
for(const [name,mutate] of Object.entries({
 wrongMemoId:ix=>ix.programId=pool,
 wrongMemoLabel:ix=>ix.program='system',
 absentMemoLabel:ix=>delete ix.program,
 objectMemo:ix=>ix.parsed={},
 memoWithData:ix=>ix.data='1',
 memoWithAccounts:ix=>ix.accounts=[]
}))test('CLI rejects noncanonical Memo: '+name,async()=>{
 const tx=withMemo(memoIds[0]);mutate(tx.transaction.message.instructions[1]);
 assert.equal(validParsedLiquidityV1(tx),false);
 const {state,calls,status}=await run(tx);assert.notEqual(status,0);assert.equal(calls.length,3);
 assert.equal(state.before,prior.before);assert.deepEqual(state.seen,prior.seen);assert.deepEqual(state.events,[]);
 assert.deepEqual(state.pendingSignatures,[sig]);assert.equal(state.complete,false);assert.equal(state.historyCoverageVerified,false);
});
