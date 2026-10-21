"""Requires a NEW, EMPTY local PostgreSQL database named glitch_controlled_merge_test.
Never point at production. Standard PG env auth only; no credentials are created.
"""
import os,pathlib,subprocess,concurrent.futures,time
D=pathlib.Path(__file__).parent
assert os.environ.get('PGDATABASE')=='glitch_controlled_merge_test', 'Disposable database name required'
host=os.environ.get('PGHOST','')
assert host in ('localhost','127.0.0.1','::1') or host.startswith('/tmp/'), 'Local disposable host required'
PSQL=os.environ.get('PSQL','psql')
def run(sql,ok=True):
 p=subprocess.run([PSQL,'-X','-q','-A','-t','-v','ON_ERROR_STOP=1'],input=sql,text=True,capture_output=True)
 if ok and p.returncode: raise AssertionError(p.stderr)
 return p
reset='TRUNCATE glitch_holder_evidence_validation,glitch_holder_scan_jobs; INSERT INTO glitch_holder_scan_jobs SELECT * FROM test_jobs_baseline; INSERT INTO glitch_holder_evidence_validation SELECT * FROM test_evidence_baseline;'
merge=(D/'synthetic-merge.sql').read_text()
run((D/'disposable-setup.sql').read_text())
def source_same():
 return run('SELECT (SELECT to_jsonb(j) FROM glitch_holder_scan_jobs j)=(SELECT to_jsonb(j) FROM test_jobs_baseline j);').stdout.strip()=='t'
run(merge)
assert run("SELECT version=42 AND status='partial' AND lease_owner IS NULL AND lease_expires_at IS NULL AND summary=(SELECT summary FROM test_jobs_baseline) AND jsonb_array_length(checkpoint#>'{networkEvidence,transfers}')=12 AND (SELECT count(*) FROM jsonb_object_keys(checkpoint#>'{networkEvidence,processed}'))=3 AND checkpoint-'networkEvidence'=(SELECT checkpoint-'networkEvidence' FROM test_jobs_baseline) FROM glitch_holder_scan_jobs;").stdout.strip()=='t'
print('PASS bounded happy path')
p=run(merge,False); assert p.returncode and 'MERGE_JOB_CHANGED' in p.stderr
assert run('SELECT version FROM glitch_holder_scan_jobs;').stdout.strip()=='42'
print('PASS repeated artifact cannot duplicate')
run(reset)
with concurrent.futures.ThreadPoolExecutor(2) as pool:
 results=list(pool.map(lambda _:run(merge,False),range(2)))
assert sum(p.returncode==0 for p in results)==1
assert run('SELECT version FROM glitch_holder_scan_jobs;').stdout.strip()=='42'
print('PASS simultaneous attempts yield one commit')
run(reset);run("UPDATE glitch_holder_evidence_validation SET status='rejected' WHERE signature LIKE '444%';")
p=run(merge,False);assert p.returncode and 'MERGE_EVIDENCE_CHANGED_OR_INVALID' in p.stderr and source_same()
print('PASS changed evidence rejected before claim')
run(reset)
p=run(merge.replace('COMMIT;',"DO $$ BEGIN RAISE EXCEPTION 'TEST_ROLLBACK'; END $$; COMMIT;"),False)
assert p.returncode and source_same()
print('PASS failure after commit-function rolls back entire transaction')
run(reset)
wrong=merge.replace('"amountRaw":"1"','"amountRaw":"999"',1)
p=run(wrong,False);assert p.returncode and source_same()
print('PASS altered manifest fails safely')
# A locked evidence writer must prevent the merge from proceeding (NOWAIT).
run(reset)
locker=subprocess.Popen([PSQL,'-X','-q','-v','ON_ERROR_STOP=1'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
locker.stdin.write("BEGIN; SELECT * FROM glitch_holder_evidence_validation WHERE signature LIKE '444%' FOR UPDATE; SELECT pg_sleep(4); ROLLBACK;\n");locker.stdin.close()
time.sleep(1)
p=run(merge,False);assert p.returncode and source_same()
locker.wait(timeout=8)
print('PASS concurrent evidence lock blocks merge without mutation')
# Exercise actual deployed SQL guards, not JavaScript mocks.
worker="22222222-2222-4222-8222-222222222222"
other="33333333-3333-4333-8333-333333333333"
id="11111111-1111-4111-8111-111111111111"
for case in ['wrong_worker','stale_version','wrong_mint','expired_lease','renewed_version']:
 run(reset)
 run(f"SELECT public.glitch_claim_holder_scan('{id}','{worker}',90);")
 if case=='expired_lease':run("UPDATE glitch_holder_scan_jobs SET lease_expires_at=clock_timestamp()-interval '1 second';")
 if case=='renewed_version':run(f"SELECT public.glitch_renew_holder_scan('{id}','{worker}',41,90);")
 before=run('SELECT to_jsonb(j)::text FROM glitch_holder_scan_jobs j;').stdout
 who=other if case=='wrong_worker' else worker
 version=40 if case=='stale_version' else 41
 cp="jsonb_set(checkpoint,'{mint}',to_jsonb('88888888888888888888888888888888'::text))" if case=='wrong_mint' else 'checkpoint'
 run(f"SELECT public.glitch_commit_holder_scan('{id}','{who}',{version},{cp},summary,'partial') FROM test_jobs_baseline;")
 assert run('SELECT to_jsonb(j)::text FROM glitch_holder_scan_jobs j;').stdout==before,case
 print('PASS actual SQL guard '+case)
# Prove a source writer cannot change locked evidence between validation and commit.
run(reset)
delayed="SET application_name='glitch_merge_lock_test';\n"+merge.replace('SELECT * INTO claimed FROM public.glitch_claim_holder_scan',"PERFORM pg_sleep(4); SELECT * INTO claimed FROM public.glitch_claim_holder_scan")
with concurrent.futures.ThreadPoolExecutor(1) as pool:
 future=pool.submit(run,delayed)
 deadline=time.monotonic()+10
 while time.monotonic()<deadline:
  if run("SELECT count(*) FROM pg_stat_activity WHERE application_name='glitch_merge_lock_test' AND wait_event='PgSleep';").stdout.strip()=='1':break
  time.sleep(.1)
 else:raise AssertionError('Did not observe locked merge pause')
 writer=run("SET lock_timeout='500ms'; UPDATE glitch_holder_evidence_validation SET status='rejected' WHERE signature LIKE '444%';",False)
 assert writer.returncode and 'lock timeout' in writer.stderr
 future.result(timeout=10)
assert run("SELECT bool_and(status='verified') FROM glitch_holder_evidence_validation;").stdout.strip()=='t'
assert run('SELECT version FROM glitch_holder_scan_jobs;').stdout.strip()=='42'
print('PASS evidence writer blocked while merge holds source locks')
print('Thirteen disposable acceptance checks passed. Additional manifest/readback review remains separate.')
