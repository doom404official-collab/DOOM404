import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {composeLiquidityQuarantine as run} from '../docs/proposals/liquidity-inactive/compose.mjs';
const a='1'.repeat(64),b='2'.repeat(64),pool='1'.repeat(32);
const prior={schemaVersion:1,pool,before:a,seen:[a],events:[],errors:[],pendingSignatures:[],complete:false,historyCoverageVerified:false,authorizationVerified:false,withdrawalVerified:false,finalScore:null,classification:'AMOUNT_RECONCILED_AUTHORIZATION_PENDING',reconciliation:{verifiedDistinct:34,recoveredPending:2,sourceDigest:'a'.repeat(64)},stopReason:'CHECKPOINTED',requestCount:0};
function fixture(){
 const sourceBytes=Buffer.from(JSON.stringify(prior)),trace=[];let claimed=false;
 const binding={repository:'doom404official-collab/DOOM404',ref:'refs/heads/fix/glitch-recovery-preflight-20261027',commit:'c'.repeat(40),run:'39729408870',attempt:1,purpose:'history',operation:'11111111-1111-4111-8111-111111111111',pool,parentDigest:createHash('sha256').update(sourceBytes).digest('hex'),semanticSourceDigest:createHash('sha256').update(JSON.stringify({pool,seen:prior.seen,events:prior.events,updatedAt:null})).digest('hex'),startsAt:1000,expiresAt:10000,requestCeiling:2};
 const o={enabled:true,binding,execution:{...binding},sourceBytes,now:()=>2000,
 session:{async query({text,values}){const op=text.includes('json_build')?'identity':text.match(/private\.(\w+)/)[1];trace.push(op);
 if(op==='identity')return {rows:[{result:{session:'liquidity_fencing_executor',current:'liquidity_fencing_executor'}}]};
 assert.equal(values[0],binding.operation);
 if(op==='read_manifest')return {rows:[{result:{...binding}}]};
 if(op==='claim'){if(claimed)throw Error('BUSY');claimed=true;return {rows:[{result:'9007199254740993'}]};}
 assert.equal(values[1],'9007199254740993');return {rows:[{result:op==='reserve'?values[2]:''}]};}},
 cycle:async({source,request})=>{await request(async()=>{trace.push('lookup');return {};});return {...source,seen:[a,b],requestCount:1};},
 publish:async({name,bytes,digest})=>{trace.push('publish');assert.equal(name,'liquidity-quarantine-'+binding.run);assert.equal(createHash('sha256').update(bytes).digest('hex'),digest);return {name,digest,artifactId:'12345'};}};
 return {o,trace};
}
test('inactive composition default reads no dependencies',async()=>{
 assert.equal((await run({get binding(){throw Error('read');},get session(){throw Error('read');}})).status,'DISABLED');
});
test('exact parameterized claim/reserve/publish/stage order never admits or changes prior',async()=>{
 const {o,trace}=fixture(),source=Buffer.from(o.sourceBytes);const result=await run(o);
 assert.equal(result.status,'STAGED_QUARANTINED');assert.equal(result.checkpointEligible,false);assert.equal(result.epoch,'9007199254740993');
 assert.deepEqual(trace,['identity','read_manifest','claim','reserve','lookup','publish','stage']);assert.deepEqual(source,o.sourceBytes);
});
test('invalid scope/window/source rejects before SQL',async()=>{
 for(const patch of [{run:'01'},{attempt:2},{purpose:'replay'},{startsAt:3000},{expiresAt:2000},{expiresAt:500000},{requestCeiling:61},{parentDigest:'b'.repeat(64)},{semanticSourceDigest:'a'.repeat(64)}]){
  const {o,trace}=fixture();Object.assign(o.binding,patch);await assert.rejects(run(o));assert.deepEqual(trace,[]);
 }
 const {o,trace}=fixture();o.execution.commit='d'.repeat(40);await assert.rejects(run(o));assert.deepEqual(trace,[]);
});
test('wrong database session identity cannot claim',async()=>{
 const {o,trace}=fixture();o.session.query=async()=>({rows:[{result:{session:'service_role',current:'liquidity_fencing_executor'}}]});
 assert.equal((await run(o)).status,'STOPPED_QUARANTINED');assert.deepEqual(trace,[]);
});
test('claim replay across reconstructed invocations and concurrent claim admits only one mock writer',async()=>{
 const {o,trace}=fixture();const results=await Promise.all([run(o),run(o)]);
 assert.equal(results.filter(r=>r.status==='STAGED_QUARANTINED').length,1);assert.equal(trace.filter(x=>x==='lookup').length,1);
 const again=await run(o);assert.equal(again.status,'RECONCILIATION_REQUIRED');assert.equal(trace.filter(x=>x==='lookup').length,1);
});
test('uncertain reservations stop before paid callback and never retry',async()=>{
 const {o,trace}=fixture(),query=o.session.query;o.session.query=async req=>{if(req.text.includes('.reserve')){trace.push('reserve-unknown');throw Error('SECRET transport');}return query(req);};
 const r=await run(o);assert.equal(r.phase,'reserve');assert.equal(r.reconciliationRequired,true);assert.equal(r.retries,0);assert.equal(trace.includes('lookup'),false);assert.equal(JSON.stringify(r).includes('SECRET'),false);
});
test('over-budget callbacks and caught lookup errors cannot proceed to publication',async()=>{
 const {o,trace}=fixture();o.binding.requestCeiling=1;o.cycle=async({source,request})=>{await request(async()=>{});await request(async()=>{});return source;};
 assert.equal((await run(o)).status,'STOPPED_QUARANTINED');assert.equal(trace.includes('publish'),false);
 const f=fixture();f.o.cycle=async({source,request})=>{try{await request(async()=>{throw Error('failure');});}catch{}return source;};
 assert.equal((await run(f.o)).status,'STOPPED_QUARANTINED');assert.equal(f.trace.includes('publish'),false);
});
test('failed lineage/accounting and promoted flags cannot publish',async()=>{
 for(const patch of [{seen:[]},{requestCount:2},{finalScore:1}]){const {o,trace}=fixture(),cycle=o.cycle;o.cycle=async args=>({...await cycle(args),...patch});assert.equal((await run(o)).status,'STOPPED_QUARANTINED');assert.equal(trace.includes('publish'),false);}
});
test('partial evidence publishes isolated diagnostic without staging',async()=>{
 const {o,trace}=fixture(),cycle=o.cycle;o.cycle=async args=>({...await cycle(args),pendingSignatures:['3'.repeat(64)]});
 const r=await run(o);assert.equal(r.status,'PARTIAL_QUARANTINED');assert.equal(r.checkpointEligible,false);assert.equal(trace.includes('stage'),false);
});
test('publication uncertainty or conflicting receipt never stages',async()=>{
 for(const mode of ['throw','conflict']){const {o,trace}=fixture();o.publish=async()=>{if(mode==='throw')throw Error('SECRET');return {artifactId:'123',digest:'f'.repeat(64)};};const r=await run(o);assert.equal(r.reconciliationRequired,true);assert.equal(r.phase,'publish');assert.equal(trace.includes('stage'),false);}
});
test('lost stage acknowledgement remains quarantined, no admission or retry',async()=>{
 const {o,trace}=fixture(),query=o.session.query;o.session.query=async req=>{const r=await query(req);if(req.text.includes('.stage'))throw Error('lost ACK');return r;};
 const r=await run(o);assert.equal(r.phase,'stage');assert.equal(r.reconciliationRequired,true);assert.equal(trace.filter(x=>x==='stage').length,1);assert.equal(trace.includes('admit'),false);
});
test('window closes after reservation and no callback or publication follows',async()=>{
 const {o,trace}=fixture(),query=o.session.query;let now=2000;o.now=()=>now;o.session.query=async req=>{const r=await query(req);if(req.text.includes('.reserve'))now=10000;return r;};
 const r=await run(o);assert.equal(r.reconciliationRequired,true);assert.equal(trace.includes('lookup'),false);assert.equal(trace.includes('publish'),false);
});
test('parent cancellation settles non-cooperative SQL, late resolution cannot dispatch another query',async()=>{
 const {o,trace}=fixture(),c=new AbortController();o.signal=c.signal;let release;
 o.session.query=()=>{trace.push('identity');c.abort();return new Promise(r=>{release=r;});};
 const r=await run(o);assert.equal(r.status,'STOPPED_QUARANTINED');release({rows:[{result:{session:'liquidity_fencing_executor',current:'liquidity_fencing_executor'}}]});await new Promise(r=>setImmediate(r));assert.deepEqual(trace,['identity']);
});
test('cancelled publication may finish externally but cannot stage or retry',async()=>{
 const {o,trace}=fixture(),c=new AbortController();o.signal=c.signal;let finish;
 o.publish=({name,digest})=>{trace.push('publish');c.abort();return new Promise(resolve=>{finish=()=>resolve({name,digest,artifactId:'12345'});});};
 const r=await run(o);assert.equal(r.reconciliationRequired,true);assert.equal(r.phase,'publish');finish();await new Promise(resolve=>setImmediate(resolve));assert.equal(trace.includes('stage'),false);assert.equal(trace.filter(x=>x==='publish').length,1);
});
test('unawaited request cannot escape cycle closure or publish a candidate',async()=>{
 const {o,trace}=fixture();let outstanding;
 o.cycle=async({source,request})=>{outstanding=request(async()=>{}).catch(()=>{});return {...source,seen:[a,b],requestCount:1};};
 const r=await run(o);await outstanding;assert.equal(r.checkpointEligible,false);assert.equal(trace.includes('publish'),false);
});
test('late rejected lookup remains handled after parent cancellation',async()=>{
 const {o,trace}=fixture(),c=new AbortController();o.signal=c.signal;let fail;let unhandled=0;
 const listener=()=>{unhandled++;};process.on('unhandledRejection',listener);
 try{
  o.cycle=async({request})=>{await request(()=>{c.abort();return new Promise((_,reject)=>{fail=reject;});});};
  const r=await run(o);assert.equal(r.status,'STOPPED_QUARANTINED');fail(Error('synthetic late failure'));await new Promise(resolve=>setImmediate(resolve));assert.equal(unhandled,0);assert.equal(trace.includes('publish'),false);
 }finally{process.off('unhandledRejection',listener);}
});
