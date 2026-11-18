import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,symlink,link,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {collectLiquidityArtifact} from '../docs/proposals/liquidity-inactive/collect.mjs';
import {reviewLiquidityArtifact} from '../docs/proposals/liquidity-inactive/review.mjs';
import {buildHistoricalReplayPlan} from '../lib/liquidityHistoricalReplayPlan.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex'),file='liquidity-history-evidence.json';
const pool='1'.repeat(32),a='1'.repeat(64),b='2'.repeat(64);
const prior={schemaVersion:1,pool,before:a,seen:[a],events:[],errors:[],pendingSignatures:[],complete:false,historyCoverageVerified:false,authorizationVerified:false,withdrawalVerified:false,finalScore:null,classification:'AMOUNT_RECONCILED_AUTHORIZATION_PENDING',reconciliation:{verifiedDistinct:34,recoveredPending:2,sourceDigest:'a'.repeat(64)},stopReason:'CHECKPOINTED',requestCount:0};
async function fixture(){
 const dir=await mkdtemp(join(tmpdir(),'lq-collect-')),source=Buffer.from(JSON.stringify(prior)),bytes=Buffer.from(JSON.stringify({...prior,seen:[a,b],requestCount:1}));await writeFile(join(dir,file),bytes);
 const binding={operation:randomUUID(),repository:'doom404official-collab/DOOM404',ref:'refs/heads/fix/glitch-recovery-preflight-20261027',commit:'c'.repeat(40),run:'123',attempt:1,purpose:'history',pool,parentDigest:hash(source),semanticSourceDigest:buildHistoricalReplayPlan(prior,{pool}).sourceDigest,startsAt:Date.now()-1000,expiresAt:Date.now()+60000,requestCeiling:2};
 const trace=[],receipt={claim:{operation:binding.operation,epoch:1},artifact:{operation:binding.operation,artifact_id:'456',digest:hash(bytes),kind:'history_candidate'},admission:null};
 const response={artifacts:[{...binding,artifactId:'456',name:'liquidity-quarantine-123',expired:false,conclusion:'success'}],files:(await collectLiquidityArtifact({enabled:true,directory:dir,run:'123',conclusion:'success',maxBytes:10000})).files};
 const options={enabled:true,operation:binding.operation,reviewId:randomUUID(),sourceBytes:source,execution:binding,maxBytes:10000,
 session:{async query({text}){trace.push(text);let result;if(text.includes('json_build'))result={session:'liquidity_fencing_reviewer',current:'liquidity_fencing_reviewer'};else if(text.includes('read_manifest'))result=binding;else if(text.includes('read_accounting'))result={receipt,reservationCount:1};else if(text.includes('record_review'))result='';else if(text.includes('.admit'))result=hash(bytes);else throw Error('UNEXPECTED');return {rows:[{result}]};}},readArtifact:async()=>{trace.push('readback');return response;}};
 return {dir,options,binding,receipt,response,trace,bytes,close:()=>rm(dir,{recursive:true,force:true})};
}
test('disabled collector/reviewer reads no dependency getters',async()=>{const o={get directory(){throw Error('read');},get session(){throw Error('read');}};assert.equal((await collectLiquidityArtifact(o)).status,'DISABLED');assert.equal((await reviewLiquidityArtifact(o)).status,'DISABLED');});
test('real filesystem collection preserves bytes and independent review precedes admission',async()=>{const f=await fixture();try{const r=await reviewLiquidityArtifact(f.options);assert.equal(r.status,'ADMITTED_RECEIPT');assert.equal(r.canonicalPublished,false);assert.deepEqual(await readFile(join(f.dir,file)),f.bytes);assert.ok(f.trace.indexOf('readback')<f.trace.findIndex(x=>x.includes('record_review')));assert.ok(f.trace.findIndex(x=>x.includes('record_review'))<f.trace.findIndex(x=>x.includes('.admit')));}finally{await f.close();}});
test('collector rejects escapes, symlink files/directories, hardlinks and oversize files',async()=>{const f=await fixture();try{const o={enabled:true,directory:f.dir,run:'123',conclusion:'success',maxBytes:10000};await assert.rejects(collectLiquidityArtifact({...o,maxBytes:1}));await writeFile(join(f.dir,'foreign.json'),'{}');await assert.rejects(collectLiquidityArtifact(o));await rm(join(f.dir,'foreign.json'));await rm(join(f.dir,file));await symlink('/etc/passwd',join(f.dir,file));await assert.rejects(collectLiquidityArtifact(o));await rm(join(f.dir,file));await writeFile(join(f.dir,'target'),'{}');await link(join(f.dir,'target'),join(f.dir,file));await assert.rejects(collectLiquidityArtifact(o));await rm(join(f.dir,'target'));await rm(join(f.dir,file));await mkdir(join(f.dir,file));await assert.rejects(collectLiquidityArtifact(o));const alias=f.dir+'-alias';await symlink(f.dir,alias);try{await assert.rejects(collectLiquidityArtifact({...o,directory:alias}));}finally{await rm(alias);}}finally{await f.close();}});
test('partial/cancelled/sidecar collection never yields reviewable success and abort does not write',async()=>{const f=await fixture();try{const o={enabled:true,directory:f.dir,run:'123',maxBytes:10000};for(const conclusion of ['failure','cancelled','unknown'])assert.equal((await collectLiquidityArtifact({...o,conclusion})).status,'QUARANTINED');await writeFile(join(f.dir,file+'.lock'),'lock');const bundle=await collectLiquidityArtifact({...o,conclusion:'success'});assert.equal(bundle.status,'QUARANTINED');f.response.files=bundle.files;assert.equal((await reviewLiquidityArtifact(f.options)).status,'REVIEW_REJECTED');const c=new AbortController();c.abort();await assert.rejects(collectLiquidityArtifact({...o,conclusion:'success',signal:c.signal}));assert.deepEqual(await readFile(join(f.dir,file)),f.bytes);}finally{await f.close();}});
for(const [label,mutate] of [
 ['digest mismatch',f=>{f.response.files[0].bytes=Buffer.from('{}');}],
 ['duplicate artifacts',f=>f.response.artifacts.push({...f.response.artifacts[0]})],
 ['foreign run',f=>{f.response.artifacts[0].run='124';}],
 ['foreign commit',f=>{f.response.artifacts[0].commit='d'.repeat(40);}],
 ['expired artifact',f=>{f.response.artifacts[0].expired=true;}],
 ['failed run',f=>{f.response.artifacts[0].conclusion='failure';}],
 ['path escape',f=>{f.response.files[0].name='../'+file;}],
 ['wrong execution',f=>{f.options.execution={...f.binding,run:'999'};}],
 ['expired seal',f=>{f.binding.expiresAt=Date.now()-1;}],
 ['already admitted',f=>{f.receipt.admission={};}],
 ['lossy epoch',f=>{f.receipt.claim.epoch=9007199254740992;}],
 ['regressed lineage',f=>{const bytes=Buffer.from(JSON.stringify({...prior,seen:[]}));f.response.files[0].bytes=bytes;f.receipt.artifact.digest=hash(bytes);}],
 ['unresolved partial',f=>{const bytes=Buffer.from(JSON.stringify({...prior,stopReason:'RETRIEVAL_INCOMPLETE'}));f.response.files[0].bytes=bytes;f.receipt.artifact.digest=hash(bytes);}]
])test('independent reviewer rejects '+label+' before mutations',async()=>{const f=await fixture();try{mutate(f);assert.equal((await reviewLiquidityArtifact(f.options)).status,'REVIEW_REJECTED');assert.equal(f.trace.some(x=>x.includes('record_review')||x.includes('.admit')),false);}finally{await f.close();}});
for(const phase of ['record_review','admit'])test('lost '+phase+' acknowledgment stops once with uncertainty',async()=>{const f=await fixture();try{const original=f.options.session.query;f.options.session.query=async q=>{const r=await original(q);if(q.text.includes('.'+(phase==='admit'?'admit_accounted':phase)))throw Error('SYNTHETIC_SECRET');return r;};const r=await reviewLiquidityArtifact(f.options);assert.equal(r.status,'RECONCILIATION_REQUIRED');assert.equal(r.phase,phase);assert.equal(r.retries,0);assert.equal(f.trace.filter(x=>x.includes('.'+(phase==='admit'?'admit_accounted':phase))).length,1);if(phase==='record_review')assert.equal(f.trace.some(x=>x.includes('.admit')),false);}finally{await f.close();}});
test('actual file changed during collection is rejected; concurrent stable readers do not modify it',async()=>{
 const f=await fixture();try{
  const o={enabled:true,directory:f.dir,run:'123',conclusion:'success',maxBytes:10000};
  const r=await Promise.all([collectLiquidityArtifact(o),collectLiquidityArtifact(o)]);assert.deepEqual(r[0].entries,r[1].entries);
  // Instrument only the read boundary with actual FileHandles and disk writes.
  const url=new URL('../docs/proposals/liquidity-inactive/collect.mjs',import.meta.url);
  let source=await readFile(url,'utf8');
  source=source.replace("import {open,lstat,realpath,readdir} from 'node:fs/promises';",`import {open as realOpen,lstat,realpath,readdir,writeFile} from 'node:fs/promises';
  let changed=false;async function open(path,flags){const h=await realOpen(path,flags);return {stat:(...a)=>h.stat(...a),close:()=>h.close(),async read(...a){const r=await h.read(...a);if(!changed){changed=true;await writeFile(path,Buffer.alloc(a[0].length,32));}return r;}};}`);
  for(const rel of ['./sidecars.mjs','../../../lib/liquidityHistoryRuntime.mjs'])source=source.replace("'"+rel+"'",JSON.stringify(new URL(rel,url).href));
  const instrumented=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  await assert.rejects(instrumented.collectLiquidityArtifact(o),/LIQUIDITY_COLLECTION_CHANGED/);
 }finally{await f.close();}
});
test('cancel during non-cooperative readback prevents later review/admission',async()=>{
 const f=await fixture();try{const c=new AbortController();let release,entered;const ready=new Promise(r=>entered=r);f.options.signal=c.signal;f.options.readArtifact=()=>{entered();return new Promise(r=>release=r);};const pending=reviewLiquidityArtifact(f.options);await ready;c.abort();const r=await pending;assert.equal(r.status,'REVIEW_REJECTED');release(f.response);await new Promise(r=>setImmediate(r));assert.equal(f.trace.some(x=>x.includes('record_review')||x.includes('.admit')),false);}finally{await f.close();}
});
test('cancellation after acknowledged review cannot be mistaken for untouched state',async()=>{
 const f=await fixture();try{const c=new AbortController(),original=f.options.session.query;f.options.signal=c.signal;f.options.session.query=async q=>{const r=await original(q);if(q.text.includes('record_review'))c.abort();return r;};const r=await reviewLiquidityArtifact(f.options);assert.equal(r.status,'RECONCILIATION_REQUIRED');assert.equal(r.retries,0);assert.equal(f.trace.some(x=>x.includes('.admit')),false);}finally{await f.close();}
});
test('oversize readback and duplicate file entries cannot reach review',async()=>{const f=await fixture();try{f.response.files.push({...f.response.files[0]});assert.equal((await reviewLiquidityArtifact(f.options)).status,'REVIEW_REJECTED');f.response.files=[{name:file,bytes:Buffer.alloc(10001)}];assert.equal((await reviewLiquidityArtifact(f.options)).status,'REVIEW_REJECTED');assert.equal(f.trace.some(x=>x.includes('record_review')),false);}finally{await f.close();}});

test('candidate request delta must equal durable reservations, not just stay below ceiling',async()=>{const f=await fixture();try{const bytes=Buffer.from(JSON.stringify({...prior,seen:[a,b],requestCount:2}));f.response.files[0].bytes=bytes;f.receipt.artifact.digest=hash(bytes);assert.equal((await reviewLiquidityArtifact(f.options)).status,'REVIEW_REJECTED');assert.equal(f.trace.some(x=>x.includes('record_review')),false);}finally{await f.close();}});
