import test from 'node:test';
import assert from 'node:assert/strict';
import {createCreatorEvidencePostgres} from '../lib/creatorEvidencePostgres.mjs';
import {createCreatorSyntheticEvidenceStorage} from '../lib/creatorEvidenceStorage.mjs';
import {TEST_OBJECT,testBytes} from '../lib/creatorEvidenceTestProfile.mjs';
test('PostgreSQL runtime is disabled and rejects missing/TLS-overridden configuration before I/O',()=>{
 assert.throws(()=>createCreatorEvidencePostgres(),/DISABLED/);
 const config={host:'localhost',port:5432,user:'synthetic',password:'synthetic',database:'synthetic',ca:'invalid'};
 for(const patch of [{},{ssl:{rejectUnauthorized:false}},{connectionString:'postgres://untrusted'},{password:''},{host:'/tmp/socket'}])assert.throws(()=>createCreatorEvidencePostgres({enabled:true,purpose:'issuer',config:{...config,...patch}}),/CONFIGURATION_REJECTED/);
 assert.throws(()=>createCreatorEvidencePostgres({enabled:true,purpose:'__proto__',config}),/CONFIGURATION_REJECTED/);
});
test('Storage requires publishable gateway key and keeps it distinct from scoped Auth JWTs',async()=>{
 let calls=0,identities=0;const identity=async()=>{identities++;return 'synthetic-auth-jwt';};
 for(const publishableKey of [undefined,'','sb_secret_elevated','eyJlegacy-service-role','sb_publishable_bad\r\n'])assert.throws(()=>createCreatorSyntheticEvidenceStorage({enabled:true,publishableKey,uploadIdentity:identity,readbackIdentity:identity}),/PUBLISHABLE_KEY_REQUIRED/);
 const store=createCreatorSyntheticEvidenceStorage({enabled:true,publishableKey:'sb_publishable_synthetic',uploadIdentity:identity,readbackIdentity:identity,fetchImpl:async(url,options)=>{calls++;assert.equal(options.headers.apikey,'sb_publishable_synthetic');assert.equal(options.headers.authorization,'Bearer synthetic-auth-jwt');assert.ok(url.endsWith('/'+TEST_OBJECT));return new Response(options.method==='GET'?testBytes():'{}');}});
 assert.equal(await store.put(TEST_OBJECT,testBytes()),true);assert.deepEqual(await store.read(TEST_OBJECT),testBytes());assert.equal(calls,2);assert.equal(identities,2);
});
