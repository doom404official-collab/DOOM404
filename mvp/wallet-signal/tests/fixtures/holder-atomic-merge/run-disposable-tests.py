"""Requires a NEW, EMPTY local PostgreSQL database named glitch_controlled_merge_test.
Never point at production. Standard PG env auth only; no credentials are created.
"""
import os,pathlib,subprocess,concurrent.futures,time,json,re,copy
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
full_fixture_sql=merge
full_fixture_match=re.search(r'm jsonb := (\$manifest_[a-f0-9]+\$)(.*?)\1::jsonb',full_fixture_sql,re.S)
assert full_fixture_match
full_fixture_manifest=json.loads(full_fixture_match.group(2))
def sql_json(value):return "'"+json.dumps(value,separators=(',',':')).replace("'","''")+"'::jsonb"
def hash_json(value):
 return run("SELECT encode(sha256(convert_to(("+sql_json(value)+")::text,'UTF8')),'hex');").stdout.strip()
def compact_manifest(m):
 c=copy.deepcopy(m)
 c['jobSha256']=hash_json(m['job'])
 c['evidenceHashes']={r['signature']:hash_json(r) for r in m['evidenceRows']}
 c['preparedCheckpointSha256']=hash_json(m['preparedCheckpoint'])
 c['job']={k:m['job'][k] for k in ['id','mint','version']}
 del c['preparedCheckpoint']
 return c
def render_compact_manifest(c):
 return full_fixture_sql[:full_fixture_match.start(2)]+json.dumps(c,separators=(',',':'))+full_fixture_sql[full_fixture_match.end(2):]
merge=render_compact_manifest(compact_manifest(full_fixture_manifest))
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

# Additional independently requested gates. Modify only disposable source/manifests.
manifest_match=re.search(r'm jsonb := (\$manifest_[a-f0-9]+\$)(.*?)\1::jsonb',merge,re.S)
assert manifest_match, 'Expected exactly one executable JSON manifest'
base_manifest=copy.deepcopy(full_fixture_manifest)
def manifest_sql(m):
 return render_compact_manifest(compact_manifest(m))
def current_job():
 return json.loads(run('SELECT to_jsonb(j)::text FROM glitch_holder_scan_jobs j;').stdout)
def snapshot():
 return run("SELECT jsonb_build_object('job',(SELECT to_jsonb(j) FROM glitch_holder_scan_jobs j),'evidence',(SELECT jsonb_agg(to_jsonb(e) ORDER BY signature) FROM glitch_holder_evidence_validation e))::text;").stdout

def sql_json(value):return "'"+json.dumps(value,separators=(',',':')).replace("'","''")+"'::jsonb"
def prepare_manifest(m):
 cp=copy.deepcopy(m['job']['checkpoint'])
 for row in m['evidenceRows']:
  transfers=row['evidence']['networkExtraction']['transfers']
  cp['networkEvidence']['processed'][row['signature']]={'valid':True,'unresolvedTokenTransfers':0,'transferCount':len(transfers)}
  cp['networkEvidence']['transfers'].extend(copy.deepcopy(transfers))
 m['preparedCheckpoint']=cp
 return m

run(reset)
run(f"SELECT public.glitch_claim_holder_scan('{id}','{other}',90);")
m=copy.deepcopy(base_manifest);m['job']=current_job()
before=snapshot();p=run(manifest_sql(m),False)
assert p.returncode and 'MERGE_CLAIM_FAILED' in p.stderr and snapshot()==before
print('PASS pinned active lease fails claim with complete preservation')

run(reset)
run(f"SELECT public.glitch_claim_holder_scan('{id}','{worker}',90);")
run("UPDATE glitch_holder_scan_jobs SET lease_expires_at=clock_timestamp()-interval '1 second';")
run(f"SELECT public.glitch_claim_holder_scan('{id}','{other}',90);")
before=snapshot()
for old_version in [41,42]:
 run(f"SELECT public.glitch_commit_holder_scan('{id}','{worker}',{old_version},checkpoint,summary,'partial') FROM test_jobs_baseline;")
 assert snapshot()==before
assert current_job()['lease_owner']==other and current_job()['version']==42
print('PASS replaced worker cannot commit even with current version')

run(reset);run("DELETE FROM glitch_holder_evidence_validation WHERE signature LIKE '444%';")
before=snapshot();p=run(merge,False)
assert p.returncode and 'query returned no rows' in p.stderr and snapshot()==before
print('PASS missing evidence row rolls back without mutation')

run(reset)
run("UPDATE glitch_holder_evidence_validation SET evidence=jsonb_set(evidence,'{networkExtraction,transfers,0,amountRaw}',to_jsonb('999'::text)) WHERE signature LIKE '444%';")
before=snapshot();p=run(merge,False)
assert p.returncode and 'MERGE_EVIDENCE_CHANGED_OR_INVALID' in p.stderr and snapshot()==before
print('PASS changed evidence content fails full-row pin')

run(reset)
fourth=copy.deepcopy(base_manifest['evidenceRows'][0]);fourth['signature']='8'*88
for transfer in fourth['evidence']['networkExtraction']['transfers']:transfer['signature']=fourth['signature']
run('INSERT INTO glitch_holder_evidence_validation SELECT * FROM jsonb_populate_record(NULL::glitch_holder_evidence_validation,'+sql_json(fourth)+');')
fourth_sql="SELECT to_jsonb(e)::text FROM glitch_holder_evidence_validation e WHERE signature LIKE '888%';"
before=run(fourth_sql).stdout
run(merge)
assert run(fourth_sql).stdout==before
assert not ('8'*88 in current_job()['checkpoint']['networkEvidence']['processed'])
assert len(current_job()['checkpoint']['networkEvidence']['transfers'])==12
print('PASS eligible fourth evidence row completely untouched')

run(reset)
def commit_then_lose_response():
 run(merge)
 raise ConnectionError('Simulated successful commit with response lost')
try:commit_then_lose_response()
except ConnectionError:pass
# No second write or retry: establish outcome using a new independent connection.
observed=current_job();expected=base_manifest
assert observed['checkpoint']==expected['preparedCheckpoint']
assert observed['summary']==expected['job']['summary']
assert observed['version']==expected['job']['version']+2 and observed['status']=='partial'
assert observed['lease_owner'] is None and observed['lease_expires_at'] is None
assert {k:v for k,v in observed.items() if k not in ['checkpoint','status','version','lease_owner','lease_expires_at','updated_at']}=={k:v for k,v in expected['job'].items() if k not in ['checkpoint','status','version','lease_owner','lease_expires_at','updated_at']}
assert run('SELECT (SELECT jsonb_agg(to_jsonb(e) ORDER BY signature) FROM glitch_holder_evidence_validation e)=(SELECT jsonb_agg(to_jsonb(e) ORDER BY signature) FROM test_evidence_baseline e);').stdout.strip()=='t'
print('PASS lost-response outcome established by exact readback without retry')

run(reset)
m=copy.deepcopy(base_manifest);m['snapshotIdentity']='wrong-reviewed-snapshot'
before=snapshot();p=run(manifest_sql(m),False)
assert p.returncode and 'MERGE_CHECKPOINT_INVALID' in p.stderr and snapshot()==before
print('PASS snapshot-identity mismatch rejected')

run(reset)
run("UPDATE glitch_holder_scan_jobs SET checkpoint=jsonb_set(checkpoint,'{networkEvidence,retentionLimited}','true'::jsonb);")
m=copy.deepcopy(base_manifest);m['job']=current_job();prepare_manifest(m)
before=snapshot();p=run(manifest_sql(m),False)
assert p.returncode and 'MERGE_CHECKPOINT_INVALID' in p.stderr and snapshot()==before
print('PASS retention-limited source rejected before claim')

run(reset)
# Pin an otherwise consistent source whose next merge would exceed retention.
run("UPDATE glitch_holder_scan_jobs SET checkpoint=jsonb_set(checkpoint,'{networkEvidence,processed}',(SELECT jsonb_object_agg('test-retained-'||n,jsonb_build_object('valid',true,'unresolvedTokenTransfers',0,'transferCount',0)) FROM generate_series(1,19998) n));")
m=copy.deepcopy(base_manifest);m['job']=current_job();prepare_manifest(m)
before=snapshot();p=run(manifest_sql(m),False)
assert p.returncode and 'MERGE_PREPARED_DIFF_INVALID' in p.stderr and snapshot()==before
print('PASS processed retention ceiling rejected before claim')
for field in ['jobSha256','preparedCheckpointSha256','evidenceHashes']:
 run(reset)
 c=compact_manifest(base_manifest)
 if field=='evidenceHashes':c[field][base_manifest['evidenceRows'][0]['signature']]='0'*64
 else:c[field]='0'*64
 before=snapshot();p=run(render_compact_manifest(c),False)
 assert p.returncode and snapshot()==before,field
 print('PASS canonical hash mismatch '+field)
print('Twenty-five disposable acceptance checks passed. Live execution manifest and permissions remain separate.')

