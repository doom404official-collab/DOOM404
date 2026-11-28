import pg from 'pg';import assert from 'node:assert/strict';import fs from 'node:fs';
const url=new URL(process.env.SCANNER_TEST_DATABASE_URL||'');if(!['127.0.0.1','localhost'].includes(url.hostname)||url.port!=='5432'||url.pathname!=='/scanner_security_test')throw Error('ISOLATED_LOCAL_DATABASE_REQUIRED');
const db=new pg.Client({connectionString:url.toString()});await db.connect();
try{
 for(const name of ['20261127085015_scanner_bounded_intelligence.sql','20261128180000_scanner_qualification_isolation.sql','20261128190000_scanner_immutable_creator_evidence.sql'])await db.query(fs.readFileSync(new URL('../../db/migrations/'+name,import.meta.url),'utf8').replaceAll('scanner_security.policy','scanner_security_validation.policy'));
 const mint='7'.repeat(32),creator='8'.repeat(32),owner='d2ce718a-96db-44ab-8d75-457bd245db5c';
 const e={mint,creator,signature:'5'.repeat(88),type:'EXTERNAL_RECEIPT',amountRaw:'12345678901234567',independentlyVerified:true,instructionVerified:true,verificationStatus:'verified_instruction_and_balance_evidence',evidenceProvenance:{mint,transactionSignature:'5'.repeat(88),instructionIdentifier:'fixture:2:3',amountRaw:'12345678901234567',slot:123,observedAt:new Date().toISOString(),decoderVersion:'fixture-v1',sourceProvider:'fixture',attributionBasis:'fixture_protocol_role'}};
 const observation={mint,status:'investigation_completed',creator:{creator,events:[e]},adaptiveCreator:{paginationRemaining:true}};
 await db.query('set role service_role');
 assert.equal((await db.query('select public.scanner_claim_investigation_v1($1,$2) as r',[mint,owner])).rows[0].r.status,'claimed');
 assert.equal((await db.query('select public.scanner_finish_investigation_v1($1,$2,$3) as r',[mint,owner,observation])).rows[0].r,true);
 assert.equal((await db.query("select extract(epoch from expires_at-updated_at)::int ttl from public.scanner_token_investigations where mint=$1",[mint])).rows[0].ttl,15);
 assert.equal((await db.query("select public.scanner_retain_creator_evidence_v1('runtime',$1) as n",[observation])).rows[0].n,0);
 assert.equal((await db.query('select amount_raw::text from public.scanner_creator_evidence')).rows[0].amount_raw,e.amountRaw);
 await db.query('insert into public.scanner_qualification_observations(run_id,candidate_sha,mint,phase,observation,metrics) values($1,$2,$3,$4,$5,$6)',['1-1','a'.repeat(40),mint,'cold',observation,{}]);
 assert.deepEqual((await db.query('select namespace from public.scanner_creator_evidence order by namespace')).rows.map(r=>r.namespace),['qualification:1-1','runtime']);
 const malformed=structuredClone(observation);malformed.creator.events[0].evidenceProvenance.mint='9'.repeat(32);await assert.rejects(db.query("select public.scanner_retain_creator_evidence_v1('runtime',$1)",[malformed]),/EVIDENCE_IDENTITY_MISMATCH/);
 await assert.rejects(db.query('delete from public.scanner_creator_evidence'),/permission denied/);
 await assert.rejects(db.query('delete from public.scanner_qualification_observations'),/permission denied/);
 await assert.rejects(db.query("update public.scanner_qualification_observations set metrics='{}'::jsonb"),/permission denied/);
 for(const role of ['anon','authenticated']){await db.query('reset role');await db.query('set role '+role);await assert.rejects(db.query('select * from public.scanner_creator_evidence'),/permission denied/);await assert.rejects(db.query("select public.scanner_retain_creator_evidence_v1('runtime',$1)",[observation]),/permission denied/);}
 console.log(JSON.stringify({status:'PASS',atomicRuntimePersistence:true,exactRawAmount:true,idempotentArchive:true,qualificationNamespaceIsolated:true,partialCursorTtlSeconds:15,publicAccessDenied:true,providerRequests:0}));
}finally{await db.end();}
