// Runs only in run-manifest-local.py's network-none container, with local TLS DNS.
import {Client} from 'pg';
import {readFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {createInactiveLiquidityPostgres} from '../../../docs/proposals/liquidity-inactive/postgres.mjs';
import {composeLiquidityQuarantine} from '../../../docs/proposals/liquidity-inactive/compose.mjs';
import {buildHistoricalReplayPlan} from '../../../lib/liquidityHistoricalReplayPlan.mjs';
const ca=readFileSync('/var/lib/postgresql/data/runtime.crt','utf8');
const common={host:'db.acwmtobcbpkjfqiatyke.supabase.co',port:5432,database:'postgres',password:'synthetic-only'};
const admin=new Client({...common,user:'postgres',ssl:{ca,rejectUnauthorized:true}});await admin.connect();
let count=0;const check=(v,label)=>{assert.ok(v,label);count++;console.log('PASS '+label);};
const adapter=(purpose,extra={})=>createInactiveLiquidityPostgres({enabled:true,purpose,config:{...common,user:'liquidity_fencing_'+purpose,ca},...extra});
const pool='1'.repeat(32),a='1'.repeat(64),b='2'.repeat(64);
const prior={schemaVersion:1,pool,before:a,seen:[a],events:[],errors:[],pendingSignatures:[],complete:false,historyCoverageVerified:false,authorizationVerified:false,withdrawalVerified:false,finalScore:null,classification:'AMOUNT_RECONCILED_AUTHORIZATION_PENDING',reconciliation:{verifiedDistinct:34,recoveredPending:2,sourceDigest:'a'.repeat(64)},stopReason:'CHECKPOINTED',requestCount:0};
const bytes=Buffer.from(JSON.stringify(prior)),digest=createHash('sha256').update(bytes).digest('hex');
async function fixture(){
 const startsAt=Date.now()-1000,expiresAt=startsAt+120000;
 const binding={operation:randomUUID(),repository:'doom404official-collab/DOOM404',ref:'refs/heads/fix/glitch-recovery-preflight-20261027',commit:'c'.repeat(40),run:'9007199254740993',attempt:1,purpose:'history',pool,parentDigest:digest,semanticSourceDigest:buildHistoricalReplayPlan(prior,{pool}).sourceDigest,requestCeiling:2,startsAt,expiresAt};
 await admin.query('TRUNCATE liquidity_fencing_private.authorities,liquidity_fencing_private.admissions,liquidity_fencing_private.reviews,liquidity_fencing_private.artifacts,liquidity_fencing_private.reservations,liquidity_fencing_private.claims,liquidity_fencing_private.manifests,liquidity_fencing_private.lane');
 await admin.query('INSERT INTO liquidity_fencing_private.lane(singleton,tip,pool) VALUES(true,$1,$2)',[digest,pool]);
 await admin.query('INSERT INTO liquidity_fencing_private.manifests VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',[binding.operation,binding.repository,binding.ref,binding.commit,binding.run,1,'history',pool,digest,binding.semanticSourceDigest,2,new Date(startsAt).toISOString(),new Date(expiresAt).toISOString()]);
 await admin.query("INSERT INTO liquidity_fencing_private.authorities VALUES($1,'liquidity_fencing_executor','liquidity_fencing_reviewer')",[binding.operation]);
 return {enabled:true,binding,execution:{...binding},sourceBytes:bytes,session:adapter('executor'),cycle:async({source,request})=>{await request(async()=>({synthetic:true}));return {...source,seen:[a,b],requestCount:1};},publish:async({name,digest})=>({name,digest,artifactId:'12345'})};
}
const readerText='SELECT liquidity_fencing_private.read_manifest($1::uuid) AS result';
try{
 check((await admin.query('SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()')).rows[0].ssl,'real local TLS');
 const rawExecutor=new Client({...common,user:'liquidity_fencing_executor',ssl:{ca,rejectUnauthorized:true}});await rawExecutor.connect();
 for(const text of ['SELECT * FROM liquidity_fencing_private.manifests','UPDATE liquidity_fencing_private.lane SET epoch=99','SET ROLE liquidity_fencing_code_owner']){await assert.rejects(rawExecutor.query(text));check(true,'exact reader extension leaves direct bypass denied: '+text.split(' ')[0]);}
 await rawExecutor.end();
 let o=await fixture();const r=await adapter('reviewer').query({text:readerText,values:[o.binding.operation]});
 check(r.rows[0].result.run==='9007199254740993','manifest bigint identity preserved as string');
 check(JSON.stringify(r.rows[0].result)===JSON.stringify(JSON.parse(JSON.stringify(r.rows[0].result))),'manifest serializable');
 assert.deepEqual(r.rows[0].result,o.binding);check(true,'exact installed manifest matches all binding fields');
 await assert.rejects(adapter('reviewer').query({text:'SELECT liquidity_fencing_private.claim($1::uuid,$2::text) AS result',values:[o.binding.operation,digest]}));check(true,'reviewer transport cannot claim');
 await assert.rejects(adapter('executor').query({text:'UPDATE liquidity_fencing_private.lane SET epoch=99',values:[]}));check(true,'transport rejects arbitrary SQL before connect');
 await assert.rejects(adapter('executor').query({text:readerText,values:[randomUUID()]}));check(true,'unbound operation denied by exact SQL');
 for(const patch of [{operation:randomUUID()},{run:'123'},{commit:'d'.repeat(40)},{expiresAt:o.binding.expiresAt-1},{requestCeiling:1}]){
  const supplied={...o,binding:{...o.binding,...patch},execution:{...o.execution,...patch}};
  const result=await composeLiquidityQuarantine(supplied);check(result.status==='STOPPED_QUARANTINED','installed mismatch stops '+Object.keys(patch)[0]);
  check((await admin.query('SELECT count(*)::int n FROM liquidity_fencing_private.claims')).rows[0].n===0,'mismatch cannot claim');
 }
 const result=await composeLiquidityQuarantine(o);check(result.status==='STAGED_QUARANTINED','real TLS/session/manifest/claim/reserve/stage composition');
 check((await admin.query('SELECT count(*)::int n FROM liquidity_fencing_private.admissions')).rows[0].n===0,'stage never admits');
 const readReceipt=await adapter('reviewer').query({text:'SELECT liquidity_fencing_private.read_receipt($1::uuid) AS result',values:[o.binding.operation]});
 check(readReceipt.rows[0].result.artifact.digest===result.digest,'independent reviewer reads staged immutable receipt');
 o=await fixture();let lookups=0;const cycle=async({source,request})=>{await request(async()=>{lookups++;});return {...source,seen:[a,b],requestCount:1};};
 const results=await Promise.all([composeLiquidityQuarantine({...o,session:adapter('executor'),cycle}),composeLiquidityQuarantine({...o,session:adapter('executor'),cycle})]);
 check(results.filter(r=>r.status==='STAGED_QUARANTINED').length===1&&lookups===1,'actual concurrent claims authorize only one lookup');
 o=await fixture();const real=o.session;o.session={async query(q){const result=await real.query(q);if(q.text.includes('.stage'))throw Error('synthetic lost response');return result;}};
 const unknown=await composeLiquidityQuarantine(o);check(unknown.reconciliationRequired&&unknown.phase==='stage','lost stage ACK remains uncertain without retry');
 check((await adapter('reviewer').query({text:'SELECT liquidity_fencing_private.read_receipt($1::uuid) AS result',values:[o.binding.operation]})).rows[0].result.artifact!==null,'lost ACK reconciles actual staged receipt separately');
 // Hold the lane to prove bounded real-driver failure; no speculative signal API.
 o=await fixture();await admin.query('BEGIN');await admin.query('SELECT * FROM liquidity_fencing_private.lane FOR UPDATE');
 const blocked=await composeLiquidityQuarantine(o);await admin.query('ROLLBACK');check(blocked.reconciliationRequired&&blocked.phase==='claim','NOWAIT contention fails closed');
 const cancel=new AbortController();cancel.abort();await assert.rejects(adapter('executor').query({text:readerText,values:[o.binding.operation],signal:cancel.signal}));check(true,'pre-cancel prevents real driver dispatch');
 // Deadline during a real server query is conservative even if rollback is expected.
 await admin.query('BEGIN');await admin.query('LOCK TABLE liquidity_fencing_private.manifests IN ACCESS EXCLUSIVE MODE');
 const began=performance.now();await assert.rejects(adapter('executor',{queryMs:30}).query({text:readerText,values:[o.binding.operation]}));await admin.query('ROLLBACK');
 check(performance.now()-began<1000,'blocked manifest query bounded and connection destroyed');
 o=await fixture();await admin.query('BEGIN');await admin.query('LOCK TABLE liquidity_fencing_private.claims IN ACCESS EXCLUSIVE MODE');
 const abortWrite=new AbortController(),write=adapter('executor',{queryMs:1000}).query({text:'SELECT liquidity_fencing_private.claim($1::uuid,$2::text) AS result',values:[o.binding.operation,digest],signal:abortWrite.signal});
 const abortTimer=setTimeout(()=>abortWrite.abort(),100);
 await assert.rejects(write,error=>error.reconciliationRequired===true&&error.retries===0);clearTimeout(abortTimer);await admin.query('ROLLBACK');
 await new Promise(resolve=>setTimeout(resolve,50));
 const reconciled=(await admin.query('SELECT count(*)::int n FROM liquidity_fencing_private.claims')).rows[0].n;
 check(reconciled===0||reconciled===1,'in-flight cancellation requires separate readback, never assumes rollback');
 console.log('LOCAL_CANCELLED_CLAIM_ROWS='+reconciled);
 check((await admin.query('SELECT epoch::text FROM liquidity_fencing_private.lane')).rows[0].epoch===String(reconciled),'cancelled mutation has no automatic second claim');
 const wrongCa=ca.replace('CERTIFICATE','INVALID');assert.throws(()=>createInactiveLiquidityPostgres({enabled:true,purpose:'executor',config:{...common,user:'liquidity_fencing_executor',ca:wrongCa}}));check(true,'invalid CA fails before connection');
 await assert.rejects(createInactiveLiquidityPostgres({enabled:true,purpose:'executor',config:{...common,user:'liquidity_fencing_executor',password:'wrong-synthetic',ca}}).query({text:readerText,values:[o.binding.operation]}));check(true,'actual SCRAM failure redacted and no fallback');
 console.log('MANIFEST_RUNTIME_CHECKS='+count);
}finally{await admin.end();}
