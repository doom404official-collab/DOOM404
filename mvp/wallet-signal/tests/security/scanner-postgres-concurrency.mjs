// Disposable CI PostgreSQL only. Never accepts Supabase or external database URLs.
import pg from 'pg';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const url=new URL(process.env.SCANNER_TEST_DATABASE_URL||'');if(!['127.0.0.1','localhost'].includes(url.hostname)||url.port!=='5432'||url.pathname!=='/scanner_security_test')throw Error('ISOLATED_LOCAL_DATABASE_REQUIRED');
const pool=new pg.Pool({connectionString:url.toString(),max:4});
try{
 await pool.query("do $$begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon;end if;if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated;end if;if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls;end if;end$$;");
 for(const path of ['../../db/migrations/20261127074008_scanner_durable_security_v1.sql','../../db/migrations/20261127074955_scanner_owner_release_authorization.sql','../../db/migrations/20261127081939_scanner_quote_burst_budget.sql']){
  let sql=await readFile(new URL(path,import.meta.url),'utf8');sql=sql.replaceAll('scanner_security','scanner_security_validation').replaceAll('scanner_admit_','scanner_validation_admit_').replaceAll('scanner_debit_','scanner_validation_debit_').replaceAll('scanner_finish_','scanner_validation_finish_').replaceAll('pg_advisory_xact_lock(404,2701)','pg_advisory_xact_lock(404,2702)');await pool.query(sql);
 }
 await pool.query(await readFile(new URL('./scanner-postgres.sql',import.meta.url),'utf8'));
 const clients=await Promise.all([pool.connect(),pool.connect()]);
 try{
  const ids=['9c184d9a-2659-408a-a304-000000000007','9c184d9a-2659-408a-a304-000000000008'];
  const rows=await Promise.all(clients.map((c,i)=>c.query("select public.scanner_validation_admit_v1(repeat('7',64),repeat('8',64),'token-current',$1::uuid) admission,pg_backend_pid() backend",[ids[i]])));
  assert.notEqual(rows[0].rows[0].backend,rows[1].rows[0].backend);assert.deepEqual(rows.map(x=>x.rows[0].admission.status).sort(),['ADMITTED','DUPLICATE']);
  const admitted=rows.find(x=>x.rows[0].admission.status==='ADMITTED').rows[0].admission.lease;
  // Monotonic consumption of an isolated local fixture, not a production quota reset.
  await pool.query("update scanner_security_validation.leases set rpc_used=3 where id=$1",[admitted]);
  const debits=await Promise.all(clients.map(c=>c.query("select public.scanner_validation_debit_v1($1::uuid,'rpc','alchemy',1) debit",[admitted])));
  assert.deepEqual(debits.map(x=>x.rows[0].debit.status).sort(),['ADMITTED','REQUEST_BUDGET']);
  const total=await pool.query('select rpc_used from scanner_security_validation.leases where id=$1',[admitted]);assert.equal(total.rows[0].rpc_used,4);
  console.log(JSON.stringify({status:'PASS',independentBackends:rows.map(x=>x.rows[0].backend),duplicateResults:rows.map(x=>x.rows[0].admission.status),lastUnitResults:debits.map(x=>x.rows[0].debit.status),providerRequests:0}));
 }finally{clients.forEach(c=>c.release());}
}finally{await pool.end();}
