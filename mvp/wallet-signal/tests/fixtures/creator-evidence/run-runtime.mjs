import {generateKeyPairSync,sign} from 'node:crypto';
import {createCreatorSyntheticRuntimeIntegration} from '../../../lib/creatorEvidenceSyntheticIntegration.mjs';
import {TEST_REF,TEST_WORKFLOW} from '../../../lib/creatorEvidenceTestProfile.mjs';
import {GITHUB_JWKS,GITHUB_ISSUER} from '../../../lib/creatorEvidenceOidc.mjs';
// Run only via the network-none disposable harness. No hosted target/env inputs.
import {Client} from 'pg';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:net';
import {createCreatorEvidencePostgres} from '../../../lib/creatorEvidencePostgres.mjs';
import {createCreatorSyntheticEvidenceClaimStore} from '../../../lib/creatorEvidenceClaimStore.mjs';
import {TEST_OBJECT,TEST_HASH,testBytes} from '../../../lib/creatorEvidenceTestProfile.mjs';
const ca=readFileSync('/var/lib/postgresql/data/runtime.crt','utf8');
const base={host:'localhost',port:5432,database:'glitch_creator_evidence_test',user:'creator_test',password:'synthetic-only',ssl:{ca,rejectUnauthorized:true}};
const admin=new Client(base);await admin.connect();assert.equal((await admin.query('select current_database() as db')).rows[0].db,base.database);
let passed=0;const check=(name,value)=>{assert.ok(value,name);passed++;console.log('PASS '+name);};
const sql=q=>admin.query(q);
await sql(readFileSync(new URL('../../../docs/proposals/creator-evidence-synthetic-disposable.sql',import.meta.url),'utf8'));
await sql("CREATE SCHEMA storage; CREATE SCHEMA auth; CREATE ROLE authenticated NOLOGIN; CREATE TABLE storage.objects(bucket_id text,name text,PRIMARY KEY(bucket_id,name)); ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;");
const start=new Date(Date.now()-1000).toISOString(),end=new Date(Date.now()+250000).toISOString();
let permissions=readFileSync(new URL('../../../docs/proposals/creator-evidence-synthetic-permissions.sql.in',import.meta.url),'utf8');
for(const [k,v] of Object.entries({UPLOAD_RUN:'123456',READ_RUN:'123457',SHA:'d'.repeat(40),UPLOAD_UID:'11111111-1111-4111-8111-111111111111',READ_UID:'22222222-2222-4222-8222-222222222222',UPLOAD_START:start,READ_START:start,UPLOAD_END:end,READ_END:end}))permissions=permissions.replaceAll('{{'+k+'}}',v);
await sql(permissions);
for(const role of ['issuer','consumer','verifier'])await sql(`CREATE ROLE creator_test_${role}_login LOGIN PASSWORD 'synthetic-only' INHERIT; GRANT creator_test_${role} TO creator_test_${role}_login;`);
check('actual pg connection verifies TLS', (await sql('select ssl from pg_stat_ssl where pid=pg_backend_pid()')).rows[0].ssl===true);
// Demonstrate the driver's real behavior rather than assuming AbortSignal support.
const plain=new Client(base);await plain.connect();const controller=new AbortController();let began=performance.now();const pending=plain.query({text:'select pg_sleep(0.15)',signal:controller.signal});setTimeout(()=>controller.abort(),10);await pending;
check('pg 8.23.1 ignores query AbortSignal (reproduced)',performance.now()-began>=100);await plain.end();
await sql('CREATE TABLE runtime_diagnostic(n integer); CREATE FUNCTION public.runtime_slow_write() RETURNS integer LANGUAGE plpgsql AS $$BEGIN PERFORM pg_sleep(0.15); INSERT INTO runtime_diagnostic VALUES(1); RETURN 1; END$$;');
const timeoutClient=new Client(base);await timeoutClient.connect();await assert.rejects(timeoutClient.query({text:'select runtime_slow_write()',query_timeout:20}));await new Promise(r=>setTimeout(r,250));
check('raw driver query_timeout can precede a committed write',(await sql('select count(*)::int n from runtime_diagnostic')).rows[0].n===1);await timeoutClient.end();
const config=purpose=>({host:'localhost',port:5432,database:base.database,user:'creator_test_'+purpose+'_login',password:'synthetic-only',ca});
const runtime=(purpose,extra={})=>createCreatorEvidencePostgres({enabled:true,purpose,config:config(purpose),connectMs:1000,queryMs:1000,...extra});
const store=purpose=>createCreatorSyntheticEvidenceClaimStore({enabled:true,client:runtime(purpose)});
const record=()=>({objectKey:TEST_OBJECT,capabilityHash:'a'.repeat(64),payloadSha256:TEST_HASH,issuedTokenHash:'c'.repeat(64),byteLength:testBytes().length,commit:'d'.repeat(40),runId:'123456',runAttempt:'1',expiresAt:Math.floor(Date.now()/1000)+200});
const reset=()=>sql('TRUNCATE creator_relay_test_private.relay_readbacks,creator_relay_test_private.relay_consumptions,creator_relay_test_private.relay_reservations');
const request=r=>({text:'SELECT creator_relay_test_private.relay_reserve($1::jsonb) AS result',values:[JSON.stringify(r)]});
const r=record();check('real TLS issuer/login/grants reserve once',await store('issuer').reserve(r));
const c={...r,tokenHash:'e'.repeat(64)};const consumed=await Promise.all([store('consumer').consume(c),store('consumer').consume(c)]);check('real concurrent clients consume exactly once',consumed.filter(Boolean).length===1);
const read={...c,deadlineSeconds:Math.floor(Date.now()/1000)+150};check('separate login readback works',!!await store('verifier').consumeReadback(read));check('readback cannot replay',await store('verifier').consumeReadback(read)===null);
await assert.rejects(runtime('verifier',{config:config('issuer')}).query({text:'SELECT creator_relay_test_private.relay_readback($1::jsonb,$2::bigint) AS result',values:[JSON.stringify(read),read.deadlineSeconds]}),/OUTCOME_UNKNOWN/);check('actual issuer cannot execute verifier function',true);
await assert.rejects(runtime('issuer').query({text:'DELETE FROM creator_relay_test_private.relay_reservations',values:[]}),/REQUEST_REJECTED/);check('runtime disallows arbitrary SQL',true);
for(const bad of [{...config('issuer'),host:'127.0.0.1'},{...config('issuer'),password:'wrong'},{...config('issuer'),ca:readFileSync('/var/lib/postgresql/data/untrusted.crt','utf8')}]){
 await assert.rejects(runtime('issuer',{config:bad}).query(request(record())),/NOT_DISPATCHED/);
}check('TLS rejects wrong hostname/untrusted CA; SCRAM rejects wrong password',true);
const aborted=new AbortController();aborted.abort();await assert.rejects(runtime('issuer').query({...request(record()),signal:aborted.signal}),/NOT_DISPATCHED/);check('pre-abort dispatches nothing',true);
await reset();const original=(await sql("select pg_get_functiondef('creator_relay_test_private.relay_reserve(jsonb)'::regprocedure) as definition")).rows[0].definition;
await sql(original.replace('BEGIN','BEGIN\n PERFORM pg_sleep(0.3);'));
const slow=runtime('issuer'),abort=new AbortController();const inFlight=slow.query({...request(record()),signal:abort.signal});await new Promise(r=>setTimeout(r,60));
await assert.rejects(slow.query(request(record())),/BUSY/);began=performance.now();abort.abort();await assert.rejects(inFlight,/OUTCOME_UNKNOWN/);check('abort settles promptly and overlapping call rejected',performance.now()-began<200);
await new Promise(r=>setTimeout(r,400));check('cancelled connection can still commit: reconciliation finds exactly one claim',(await sql('select count(*)::int n from creator_relay_test_private.relay_reservations')).rows[0].n===1);
await reset();
began=performance.now();await assert.rejects(runtime('issuer',{queryMs:60}).query(request(record())),/OUTCOME_UNKNOWN/);check('query deadline bounded without retry',performance.now()-began<500);await new Promise(r=>setTimeout(r,350));check('timed-out statement did not advance claim',(await sql('select count(*)::int n from creator_relay_test_private.relay_reservations')).rows[0].n===0);
await sql(original);
// A TLS handshake that never responds must not retain an open connection.
const sockets=new Set(),stall=createServer(socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));socket.resume();});await new Promise(r=>stall.listen(0,'127.0.0.1',r));
began=performance.now();await assert.rejects(runtime('issuer',{config:{...config('issuer'),host:'127.0.0.1',port:stall.address().port},connectMs:60}).query(request(record())),/NOT_DISPATCHED/);await new Promise(r=>setTimeout(r,80));check('stalled handshake bounded and socket closed',performance.now()-began<500&&sockets.size===0);await new Promise(r=>stall.close(r));
await new Promise(r=>setTimeout(r,100));check('no runtime sessions retained',(await sql("select count(*)::int n from pg_stat_activity where application_name='creator-evidence-test'")).rows[0].n===0);

await reset();
const timestamp=Math.floor(Date.now()/1000),{privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...publicKey.export({format:'jwk'}),kid:'runtime-synthetic',alg:'RS256',use:'sig'};
const manifest={repository:'doom404official-collab/DOOM404',repository_id:'1405094598',repository_owner:'doom404official-collab',repository_owner_id:'335732040',ref:TEST_REF,sha:'d'.repeat(40),workflow_sha:'d'.repeat(40),workflow_ref:'doom404official-collab/DOOM404/.github/workflows/'+TEST_WORKFLOW+'@'+TEST_REF,run_id:'123456',run_attempt:'1',event_name:'workflow_dispatch',environment:'synthetic',runner_environment:'github-hosted',sub:'synthetic-exact',audience:'https://relay.invalid/upload',startsAt:timestamp-1,expiresAt:timestamp+200};
const readManifest={...manifest,run_id:'123457',audience:'https://relay.invalid/read'};
const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
const token=policy=>{const {audience,startsAt,expiresAt,...claims}=policy;const unsigned=encode({alg:'RS256',typ:'JWT',kid:jwk.kid})+'.'+encode({...claims,iss:GITHUB_ISSUER,aud:audience,iat:timestamp,nbf:timestamp,exp:timestamp+200,jti:'synthetic-'+policy.run_id});return unsigned+'.'+sign('RSA-SHA256',Buffer.from(unsigned),privateKey).toString('base64url');};
let stored,puts=0,reads=0,keys=0;
const handler=createCreatorSyntheticRuntimeIntegration({enabled:true,manifest,readManifest,postgresConfigs:Object.fromEntries(['issuer','consumer','verifier'].map(p=>[p,config(p)])),publishableKey:'sb_publishable_synthetic',uploadIdentity:async()=> 'synthetic-upload',readbackIdentity:async()=> 'synthetic-read',fetchImpl:async(url,o)=>{
 if(url===GITHUB_JWKS){keys++;return new Response(JSON.stringify({keys:[jwk]}));}
 assert.ok(url.endsWith('/'+TEST_OBJECT));assert.equal(o.headers.apikey,'sb_publishable_synthetic');
 if(o.method==='POST'){puts++;assert.equal(stored,undefined);assert.equal(o.headers.authorization,'Bearer synthetic-upload');stored=Buffer.from(o.body);return new Response('{}');}
 reads++;assert.equal(o.headers.authorization,'Bearer synthetic-read');return new Response(stored);
}});
const httpRequest=(action,body,policy=manifest,cap)=>new Request('https://relay.invalid/api/creator-evidence-test/'+action,{method:'POST',headers:{authorization:'Bearer '+token(policy),'content-type':'application/json',...(cap?{'x-creator-capability':cap}:{})},body});
const issued=await handler(httpRequest('issue','{}'));assert.equal(issued.status,200);const cap=(await issued.json()).capability;
assert.equal((await handler(httpRequest('upload',testBytes(),manifest,cap))).status,200);
const verified=await handler(httpRequest('verify','{}',readManifest));assert.equal(verified.status,200);assert.equal((await verified.json()).payloadSha256,TEST_HASH);
check('real driver/TLS/roles compose with crypto and mocked Storage',puts===1&&reads===1&&keys===3);
assert.notEqual((await handler(httpRequest('upload',testBytes(),manifest,cap))).status,200);check('composed replay causes no second Storage dispatch',puts===1);
await admin.end();console.log(JSON.stringify({passed,driver:'pg 8.23.1',tls:true,hostedAccess:false,retries:0}));
