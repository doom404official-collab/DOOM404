// Private SQL adapter bridge; never HTTP and no remote target/credential inputs.
import {execFileSync,spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {createCreatorEvidenceClaimStore} from '../../../lib/creatorEvidenceClaimStore.mjs';
const container='creator-evidence-disposable',db='glitch_creator_evidence_test';
const info=JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8'}))[0];assert.equal(info.HostConfig.NetworkMode,'none');assert.equal(info.Config.Image,'postgres:17');assert.ok(info.Mounts.every(m=>m.Type==='tmpfs'));
function sql(text){return new Promise((resolve,reject)=>{const p=spawn('docker',['exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','creator_test','-d',db],{stdio:['pipe','pipe','pipe']});let out='',err='';p.stdout.on('data',v=>out+=v);p.stderr.on('data',v=>err+=v);p.on('error',reject);p.on('close',code=>code?reject(Error(err)):resolve(out.trim()));p.stdin.end(text);});}
assert.equal(await sql('SELECT current_database()'),db);
await sql('TRUNCATE creator_private.relay_readbacks,creator_private.relay_consumptions,creator_private.relay_reservations');
let queries=0;
const client={async query({text,values,signal}){signal?.throwIfAborted();queries++;assert.match(text,/^SELECT creator_private\.relay_(reserve|consume|readback)\(\$1::jsonb(,\$2::bigint)?\) AS result$/);let query=text;if(values.length===2){assert.ok(Number.isSafeInteger(values[1]));query=query.replace('$2::bigint',String(values[1])+'::bigint');}query=query.replace('$1::jsonb',"'"+values[0].replaceAll("'","''")+"'::jsonb");return {rows:[JSON.parse(await sql('SELECT row_to_json(t) FROM ('+query+') t'))]};}};
const create=()=>createCreatorEvidenceClaimStore({enabled:true,client});
const record={objectKey:'global/442809233/4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf/9aa57beb2b897cc175a536f170ddb25c0c8bed8ed6620c7087d8a7fb834f7d30.json',capabilityHash:'a'.repeat(64),payloadSha256:'b'.repeat(64),issuedTokenHash:'c'.repeat(64),byteLength:42,commit:'d'.repeat(40),runId:'123456',runAttempt:'1',expiresAt:Math.floor(Date.now()/1000)+240};
assert.equal(await create().reserve(record),true);assert.equal(await create().reserve(record),false);
const consume={...record,tokenHash:'e'.repeat(64)};
const results=await Promise.all([create().consume(consume),create().consume(consume)]);assert.equal(results.filter(Boolean).length,1);assert.deepEqual(results.find(Boolean),record);
assert.deepEqual(await create().consumeReadback({...consume,deadlineSeconds:Math.floor(Date.now()/1000)+200}),record);assert.equal(await create().consumeReadback({...consume,deadlineSeconds:Math.floor(Date.now()/1000)+200}),null);
assert.equal(queries,6);console.log('PASS real claims adapter reserve/concurrent consume/separate readback across PostgreSQL connections; no HTTP');
