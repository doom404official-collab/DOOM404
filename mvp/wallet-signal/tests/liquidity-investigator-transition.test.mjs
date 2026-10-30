import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {openSync,closeSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {assessHistorySuccessor,assertRetainedHistory} from '../lib/liquidityHistorySuccessor.mjs';
import {assessAutomaticHistoryCheckpoint} from '../lib/liquidityAutomaticHistoryGate.mjs';
const pool='11111111111111111111111111111111',a='1'.repeat(64),b='2'.repeat(64),c='3'.repeat(64),d='4'.repeat(64);
const prior={schemaVersion:1,pool,before:b,seen:[a,b],events:[],errors:[],pages:2,requestCount:109,pendingSignatures:[],complete:false,historyCoverageVerified:false,authorizationVerified:false,withdrawalVerified:false,finalScore:null,classification:'AMOUNT_RECONCILED_AUTHORIZATION_PENDING',reconciliation:{verifiedDistinct:34,recoveredPending:2,sourceDigest:'a'.repeat(64)},stopReason:'CHECKPOINTED'};
async function investigate(pages,{source=prior,budget=6,exitCode=0,transactionPatch={}}={}){
 const dir=await mkdtemp(join(tmpdir(),'lq-transition-'));
 try{
  const checkpoint=join(dir,'prior.json'),output=join(dir,'next.json'),mock=join(dir,'mock.mjs'),stdout=join(dir,'stdout'),stderr=join(dir,'stderr');
  await writeFile(checkpoint,JSON.stringify(source));
  await writeFile(mock,`const pages=${JSON.stringify(pages)};let index=0,calls=0;globalThis.fetch=async(url,o)=>{if(url!=='https://offline.invalid')throw Error('UNEXPECTED_DESTINATION');if(++calls>${budget})throw Error('MOCK_BUDGET_EXCEEDED');const q=JSON.parse(o.body);let result;if(q.method==='getSignaturesForAddress')result=(pages[index++]??[]).map(signature=>typeof signature==='string'?({signature,slot:123}):signature);else if(q.method==='getTransaction')result={slot:123,transaction:{signatures:[q.params[0]],message:{instructions:[]}},meta:{err:null,innerInstructions:[]},...${JSON.stringify(transactionPatch)}};else throw Error('UNEXPECTED_METHOD');return {ok:true,json:async()=>({result})};};process.on('exit',()=>console.log('MOCK_CALLS='+calls));`);
  const out=openSync(stdout,'w'),err=openSync(stderr,'w');let proc;
  try{proc=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['--import',mock,new URL('../scripts/liquidity-historical-investigator.mjs',import.meta.url).pathname],{env:{PATH:process.env.PATH,NODE_OPTIONS:process.env.NODE_OPTIONS||'',GLITCH_LIQUIDITY_POOL:pool,HELIUS_RPC_URL:'https://offline.invalid',ALCHEMY_RPC_URL:'',GLITCH_HISTORY_CHECKPOINT:checkpoint,GLITCH_HISTORY_OUTPUT:output,GLITCH_HISTORY_PAGE_SIZE:'25',GLITCH_HISTORY_BUDGET:String(budget)},stdio:['ignore',out,err],timeout:10000});child.once('error',reject);child.once('close',(status,signal)=>resolve({status,signal}));});}finally{closeSync(out);closeSync(err);}
  assert.equal(proc.error,undefined);assert.equal(proc.signal,null);assert.equal(proc.status,exitCode,readFileSync(stderr,'utf8'));
  const next=JSON.parse(await readFile(output,'utf8')),calls=Number(readFileSync(stdout,'utf8').match(/MOCK_CALLS=(\d+)/)?.[1]);assert.ok(Number.isSafeInteger(calls));assert.ok(calls<=budget);assert.equal(next.requestCount,source.requestCount+calls);assert.deepEqual(JSON.parse(await readFile(checkpoint,'utf8')),source);
  assert.equal(next.finalScore,null);assert.equal(next.authorizationVerified,false);assert.equal(next.withdrawalVerified,false);return {next,calls};
 }finally{await rm(dir,{recursive:true,force:true});}
}
test('real investigator empty terminal page retains cursor AND page count',async()=>{
 const {next,calls}=await investigate([[]]);assert.equal(calls,1);assert.equal(next.pages,2);assert.equal(next.before,b);assert.equal(next.complete,true);assert.equal(assessHistorySuccessor(prior,next,pool).action,'STOP_HISTORY_EXHAUSTED');
});
test('real investigator new page then empty advances once and accepts terminal successor',async()=>{
 const {next,calls}=await investigate([[c],[]]);assert.equal(calls,3);assert.equal(next.pages,3);assert.equal(next.before,c);assert.equal(assessHistorySuccessor(prior,next,pool).action,'STOP_HISTORY_EXHAUSTED');
});
test('real investigator partial page at budget retains page and cursor with new seen evidence',async()=>{
 const {next,calls}=await investigate([[c,d]],{budget:2});assert.equal(calls,2);assert.equal(next.pages,2);assert.equal(next.before,b);assert.deepEqual(next.seen,[a,b,c]);assert.equal(next.complete,false);assert.equal(assessHistorySuccessor(prior,next,pool).action,'CONTINUE_BOUNDED');
});
for(const overlap of [[b],[a],[a,b],[b,b]])test('overlap/replayed page stops before fabricated advancement '+JSON.stringify(overlap),async()=>{
 const {next,calls}=await investigate([overlap,[]],{exitCode:1});assert.equal(calls,1);assert.deepEqual(next.seen,prior.seen);assert.equal(next.pages,prior.pages);assert.equal(next.before,prior.before);assert.equal(next.complete,false);assert.equal(next.historyCoverageVerified,false);assert.equal(assessHistorySuccessor(prior,next,pool).action,'PAUSE_EVIDENCE_ERROR');
});
test('pending-only recovery preserves lineage but cannot use noncontinuable prior automatically',async()=>{
 const source={...prior,pendingSignatures:[c],unresolvedReasons:{[c]:'RPC_TRANSACTION_UNAVAILABLE'},stopReason:'RETRIEVAL_INCOMPLETE'};
 const {next}=await investigate([[c],[]],{source});assert.deepEqual(next.pendingSignatures,[]);assert.deepEqual(next.seen,[a,b,c]);assert.equal(next.pages,3);assert.equal(next.before,c);assertRetainedHistory(source,next);assert.throws(()=>assessHistorySuccessor(source,next,pool),/PRIOR_CHECKPOINT_NOT_CONTINUABLE/);
});
test('empty page cannot complete unresolved pending recovery',async()=>{
 const source={...prior,pendingSignatures:[c],stopReason:'RETRIEVAL_INCOMPLETE'};const {next}=await investigate([[]],{source});assert.equal(next.complete,false);assert.equal(next.historyCoverageVerified,false);assert.equal(next.pages,2);assert.equal(next.before,b);assert.equal(assessAutomaticHistoryCheckpoint(next,pool).action,'PAUSE_UNRESOLVED_SIGNATURES');
});
for(const page of [[c,c],[c,d,c],[{signature:c,slot:123},{signature:c,slot:124}],[c,null],[c,{signature:d,slot:-1}],[c,{signature:d,slot:1.5}]])test('whole-page rejection preserves evidence before transaction work '+JSON.stringify(page),async()=>{
 const {next,calls}=await investigate([page,[]],{exitCode:1});assert.equal(calls,1);assert.deepEqual(next.seen,prior.seen);assert.deepEqual(next.events,prior.events);assert.equal(next.pages,prior.pages);assert.equal(next.before,prior.before);assert.equal(next.signaturesAttemptedThisRun,0);assert.equal(next.complete,false);assert.equal(next.historyCoverageVerified,false);assert.equal(next.stopReason,'RETRIEVAL_INCOMPLETE');assert.equal(assessHistorySuccessor(prior,next,pool).action,'PAUSE_EVIDENCE_ERROR');assert.match(next.errors.at(-1).message,/DUPLICATE_SIGNATURE_PAGE|INVALID_SIGNATURE_PAGE/);
});
test('interrupted partial page resumes unique overlap without duplicate lookup or lost prefix',async()=>{
 const first=await investigate([[c,d]],{budget:2});
 const second=await investigate([[c,d],[]],{source:first.next});assert.equal(second.calls,3);assert.deepEqual(second.next.seen,[a,b,c,d]);assert.equal(second.next.pages,3);assert.equal(second.next.before,d);assertRetainedHistory(first.next,second.next);assert.equal(assessHistorySuccessor(first.next,second.next,pool).action,'STOP_HISTORY_EXHAUSTED');
});
test('duplicate page after interruption does not discard the previously paid lookup',async()=>{
 const first=await investigate([[c,d]],{budget:2});
 const second=await investigate([[c,d,d],[]],{source:first.next,exitCode:1});assert.equal(second.calls,1);assert.deepEqual(second.next.seen,first.next.seen);assertRetainedHistory(first.next,second.next);assert.equal(second.next.complete,false);
});
test('independent isolated invocations retain identical lineage on duplicate-page rejection',async()=>{
 // No distributed lock is claimed: separate output files are intentional.
 const results=await Promise.all([investigate([[c,c],[]],{exitCode:1}),investigate([[c,c],[]],{exitCode:1})]);
 for(const {next,calls} of results){assert.equal(calls,1);assertRetainedHistory(prior,next);assert.equal(next.complete,false);}
 for(const field of ['seen','events','errors','before','pages','requestCount','stopReason'])assert.deepEqual(results[0].next[field],results[1].next[field]);
});
test('rejected page preserves pending evidence, provenance and historical errors',async()=>{
 const source={...prior,pendingSignatures:[c],unresolvedReasons:{[c]:'RPC_TRANSACTION_UNAVAILABLE'},errors:[{stage:'transaction',signature:c,message:'retained historical failure'}],stopReason:'RETRIEVAL_INCOMPLETE'};
 const {next,calls}=await investigate([[c,c],[]],{source,exitCode:1});
 assert.equal(calls,1);assertRetainedHistory(source,next);assert.deepEqual(next.reconciliation,source.reconciliation);assert.deepEqual(next.pendingSignatures,source.pendingSignatures);assert.deepEqual(next.unresolvedReasons,source.unresolvedReasons);assert.equal(next.errors.length,source.errors.length+1);assert.equal(next.complete,false);assert.equal(next.historyCoverageVerified,false);assert.equal(assessAutomaticHistoryCheckpoint(next,pool).action,'PAUSE_UNRESOLVED_SIGNATURES');
});
test('legacy cursor outside seen still cannot be returned as its own successor',async()=>{
 const source={...prior,before:c};const {next,calls}=await investigate([[c],[]],{source,exitCode:1});assert.equal(calls,1);assert.equal(next.before,c);assert.equal(next.pages,source.pages);assert.deepEqual(next.seen,source.seen);assert.equal(next.errors.at(-1).message,'HISTORY_CURSOR_NOT_ADVANCING');assert.equal(next.complete,false);
});

for(const [name,transactionPatch] of Object.entries({wrongSignature:{transaction:{signatures:[a],message:{instructions:[]}}},wrongFailedSignature:{transaction:{signatures:[a]},meta:{err:'AccountNotFound'}},missingExecution:{meta:{}},malformedExecution:{meta:{err:false}},unsupported:{version:1},conflictingInner:{meta:{err:null,innerInstructions:[{index:0,instructions:[]},{index:0,instructions:[]}]}}}))test('real investigator retains Unknown for '+name,async()=>{
 const {next,calls}=await investigate([[c],[]],{transactionPatch,exitCode:1});assert.equal(calls,2);assert.deepEqual(next.seen,prior.seen);assert.deepEqual(next.pendingSignatures,[c]);assert.equal(next.before,prior.before);assert.equal(next.pages,prior.pages);assert.equal(next.complete,false);assert.equal(next.historyCoverageVerified,false);assert.equal(next.events.length,0);
});
test('positively identified failed execution settles no candidate and needs no pending retry',async()=>{
 const {next,calls}=await investigate([[c],[]],{transactionPatch:{meta:{err:{InstructionError:[0,{Custom:1}]}}}});assert.equal(calls,3);assert.deepEqual(next.seen,[a,b,c]);assert.deepEqual(next.pendingSignatures,[]);assert.deepEqual(next.events,[]);assert.equal(next.authorizationVerified,false);assert.equal(next.withdrawalVerified,false);
});
