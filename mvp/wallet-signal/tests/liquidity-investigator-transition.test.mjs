import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {openSync,closeSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {assessHistorySuccessor,assertRetainedHistory} from '../lib/liquidityHistorySuccessor.mjs';
import {assessAutomaticHistoryCheckpoint} from '../lib/liquidityAutomaticHistoryGate.mjs';
const pool='11111111111111111111111111111111',a='1'.repeat(64),b='2'.repeat(64),c='3'.repeat(64),d='4'.repeat(64);
const prior={schemaVersion:1,pool,before:b,seen:[a,b],events:[],errors:[],pages:2,requestCount:109,pendingSignatures:[],complete:false,historyCoverageVerified:false,authorizationVerified:false,withdrawalVerified:false,finalScore:null,classification:'AMOUNT_RECONCILED_AUTHORIZATION_PENDING',reconciliation:{verifiedDistinct:34,recoveredPending:2,sourceDigest:'a'.repeat(64)},stopReason:'CHECKPOINTED'};
async function investigate(pages,{source=prior,budget=6}={}){
 const dir=await mkdtemp(join(tmpdir(),'lq-transition-'));
 try{
  const checkpoint=join(dir,'prior.json'),output=join(dir,'next.json'),mock=join(dir,'mock.mjs'),stdout=join(dir,'stdout'),stderr=join(dir,'stderr');
  await writeFile(checkpoint,JSON.stringify(source));
  await writeFile(mock,`const pages=${JSON.stringify(pages)};let index=0,calls=0;globalThis.fetch=async(url,o)=>{if(url!=='https://offline.invalid')throw Error('UNEXPECTED_DESTINATION');if(++calls>${budget})throw Error('MOCK_BUDGET_EXCEEDED');const q=JSON.parse(o.body);let result;if(q.method==='getSignaturesForAddress')result=(pages[index++]??[]).map(signature=>({signature,slot:123}));else if(q.method==='getTransaction')result={slot:123,transaction:{signatures:[q.params[0]],message:{instructions:[]}},meta:{err:null,innerInstructions:[]}};else throw Error('UNEXPECTED_METHOD');return {ok:true,json:async()=>({result})};};process.on('exit',()=>console.log('MOCK_CALLS='+calls));`);
  const out=openSync(stdout,'w'),err=openSync(stderr,'w');let proc;
  try{proc=spawnSync(process.execPath,['--import',mock,new URL('../scripts/liquidity-historical-investigator.mjs',import.meta.url).pathname],{env:{PATH:process.env.PATH,NODE_OPTIONS:process.env.NODE_OPTIONS||'',GLITCH_LIQUIDITY_POOL:pool,HELIUS_RPC_URL:'https://offline.invalid',ALCHEMY_RPC_URL:'',GLITCH_HISTORY_CHECKPOINT:checkpoint,GLITCH_HISTORY_OUTPUT:output,GLITCH_HISTORY_PAGE_SIZE:'25',GLITCH_HISTORY_BUDGET:String(budget)},stdio:['ignore',out,err],timeout:10000});}finally{closeSync(out);closeSync(err);}
  assert.equal(proc.error,undefined);assert.equal(proc.signal,null);assert.equal(proc.status,0,readFileSync(stderr,'utf8'));
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
for(const overlap of [[b],[a],[a,b]])test('overlap-only page is not valid progress '+overlap.length+overlap[0][0],async()=>{
 const {next}=await investigate([overlap,[]]);assert.deepEqual(next.seen,prior.seen);assert.equal(next.pages,3);assert.throws(()=>assessHistorySuccessor(prior,next,pool),/HISTORY_PAGE_CURSOR_MISMATCH|HISTORY_CURSOR_REGRESSION/);
});
test('repeated duplicate page cannot use terminal empty page to legitimize stalled cursor',async()=>{
 const {next}=await investigate([[b],[b],[]]);assert.equal(next.pages,4);assert.equal(next.before,b);assert.throws(()=>assessHistorySuccessor(prior,next,pool),/HISTORY_PAGE_CURSOR_MISMATCH/);
});
test('pending-only recovery preserves lineage but cannot use noncontinuable prior automatically',async()=>{
 const source={...prior,pendingSignatures:[c],unresolvedReasons:{[c]:'RPC_TRANSACTION_UNAVAILABLE'},stopReason:'RETRIEVAL_INCOMPLETE'};
 const {next}=await investigate([[c],[]],{source});assert.deepEqual(next.pendingSignatures,[]);assert.deepEqual(next.seen,[a,b,c]);assert.equal(next.pages,3);assert.equal(next.before,c);assertRetainedHistory(source,next);assert.throws(()=>assessHistorySuccessor(source,next,pool),/PRIOR_CHECKPOINT_NOT_CONTINUABLE/);
});
test('empty page cannot complete unresolved pending recovery',async()=>{
 const source={...prior,pendingSignatures:[c],stopReason:'RETRIEVAL_INCOMPLETE'};const {next}=await investigate([[]],{source});assert.equal(next.complete,false);assert.equal(next.historyCoverageVerified,false);assert.equal(next.pages,2);assert.equal(next.before,b);assert.equal(assessAutomaticHistoryCheckpoint(next,pool).action,'PAUSE_UNRESOLVED_SIGNATURES');
});
test('legacy investigator loses within-page duplicate information before successor validation',async()=>{
 // This is a limitation proof, not approval of malformed provider pages.
 // The reviewed later main investigator rejects duplicate entries at ingestion;
 // this older isolated-branch investigator has not been replaced in this slice.
 const duplicate=await investigate([[c,c],[]]),unique=await investigate([[c],[]]);
 for(const field of ['seen','before','pages','requestCount','events','pendingSignatures'])assert.deepEqual(duplicate.next[field],unique.next[field]);
 assert.equal(assessHistorySuccessor(prior,duplicate.next,pool).action,'STOP_HISTORY_EXHAUSTED');
});
