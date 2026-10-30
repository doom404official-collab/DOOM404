// Disposable-only transport seam: real endpoint/pg query contract + PostgreSQL
// through local docker exec. No network, hosted Auth, Storage, or real credentials.
import assert from 'node:assert/strict';import {Client} from 'pg';
import {execFileSync} from 'node:child_process';import {mkdtempSync,readFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';
import {generateKeyPairSync,sign} from 'node:crypto';
import {createCreatorSyntheticEndpoint} from '../../../lib/creatorEvidenceEndpoint.mjs';
import {runCreatorSyntheticAttempt} from '../../../lib/creatorEvidenceSyntheticRunner.mjs';
import {response,U,R} from './owner-auth-fixture.mjs';
import {GITHUB_JWKS} from '../../../lib/creatorEvidenceOidc.mjs';
const container=process.argv[2];assert.equal(container,'creator-server-session');
const trace=[];
function sql(q,user='postgres'){return execFileSync('docker',['exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U',user,'-d','glitch_creator_evidence_test'],{input:q,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();}
const b=JSON.parse(sql('SELECT binding FROM creator_relay_test_private.sealed_test_window'));
Client.prototype.connect=async()=>{};Client.prototype.end=async()=>{};
Client.prototype.query=async function(q){trace.push(q.text.match(/\.(\w+)\(/)[1]);let text=q.text;for(let i=q.values.length-1;i>=0;i--)text=text.replace('$'+(i+1),typeof q.values[i]==='number'?String(q.values[i]):"'"+q.values[i].replaceAll("'","''")+"'");const value=sql(text,this.user);return {rows:[{result:value==='t'?true:value==='f'?false:value?JSON.parse(value):null}]};};
const dir=mkdtempSync(tmpdir()+'/creator-e2e-');let ca;try{execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',dir+'/key','-out',dir+'/cert','-days','1','-subj','/CN=synthetic'],{stdio:'ignore'});ca=readFileSync(dir+'/cert','utf8');}finally{rmSync(dir,{recursive:true});}
const env={VERCEL_ENV:'preview',VERCEL_TARGET_ENV:'preview',VERCEL_GIT_COMMIT_REF:b.upload.ref.slice(11),VERCEL_PROJECT_ID:b.vercelProjectId,VERCEL_DEPLOYMENT_ID:b.deploymentId,VERCEL_URL:b.deploymentUrl.slice(8),VERCEL_GIT_COMMIT_SHA:b.commit,CREATOR_TEST_DB_CA_PEM:ca,CREATOR_MACHINE_PUBLISHABLE_KEY:'sb_publishable_synthetic'};
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});const jwks={keys:[{...publicKey.export({format:'jwk'}),kid:'local',use:'sig',alg:'RS256'}]};
function token(m){const enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url');const t=Math.floor(Date.now()/1000);const value=enc({alg:'RS256',typ:'JWT',kid:'local'})+'.'+enc({...m,iss:'https://token.actions.githubusercontent.com',aud:m.audience,iat:t,nbf:t,exp:m.expiresAt,jti:'local-'+m.run_id});return value+'.'+sign('RSA-SHA256',Buffer.from(value),privateKey).toString('base64url');}
let stored,failRead=process.argv.includes('--uncertain'),authCount=0;
const deps={readVariable:k=>{if(k.endsWith('_PASSWORD')){trace.push(k);return 'SYNTHETIC_PASSWORD';}return env[k];},fetchImpl:async(url,o)=>{
 if(url===GITHUB_JWKS)return Response.json(jwks);
 if(url.includes('/auth/v1/token')){authCount++;const read=JSON.parse(o.body).email==='vijayananthrajkumar@gmail.com';trace.push(read?'AUTH_READ':'AUTH_UPLOAD');if(read&&failRead)throw Error('SYNTHETIC_PRIVATE');return Response.json(response(read?R:U,Math.floor(Date.now()/1000)));}
 assert.ok(url.endsWith('/'+b.objectKey));trace.push(o.method==='POST'?'PUT':'GET');if(o.method==='POST'){assert.equal(stored,undefined);stored=Buffer.from(o.body);return Response.json({});}return new Response(stored);
}};
const endpoint=()=>createCreatorSyntheticEndpoint({enabled:true},deps);
async function run(action){const m=action==='upload'?b.upload:b.readback;const h=endpoint();return runCreatorSyntheticAttempt({enabled:true,action,manifest:m,identity:m},{getOidcToken:async()=>token(m),fetchImpl:(u,o)=>h(new Request(u,o))});}
const results=await Promise.all([run('upload'),run('upload')]);assert.equal(results.filter(r=>r.status==='UPLOAD_REPORTED').length,1);assert.equal(authCount,1);
assert.equal((await run('readback')).status,failRead?'RECONCILIATION_REQUIRED':'READBACK_VERIFIED');assert.equal(authCount,2);
await run('readback');assert.equal(authCount,2);
assert.equal(sql("SELECT count(*) FROM creator_relay_test_private.auth_attempts WHERE outcome='UNKNOWN'"),'2');
const before=authCount;sql('UPDATE creator_relay_test_private.sealed_test_window SET closed_at=clock_timestamp()');await run('upload');assert.equal(authCount,before);
for(const [a,z] of [['relay_consume','CREATOR_MACHINE_UPLOAD_PASSWORD'],['relay_auth_attempt','AUTH_UPLOAD'],['relay_readback','CREATOR_MACHINE_READBACK_PASSWORD']])assert.ok(trace.indexOf(a)>=0&&trace.indexOf(a)<trace.indexOf(z));
assert.equal(trace.filter(x=>x==='PUT').length,1);assert.equal(trace.filter(x=>x==='GET').length,failRead?0:1);
console.log('SESSION_ENDPOINT_SQL_E2E_PASS '+(failRead?'uncertain-readback':'success')+' '+JSON.stringify(trace));
