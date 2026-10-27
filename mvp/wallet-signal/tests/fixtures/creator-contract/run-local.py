"""Synthetic contract tests. Requires the exact disposable, network-isolated Docker
container created in README.md. No external host/credentials or SQL URI accepted.
"""
import concurrent.futures,json,pathlib,subprocess,time
D=pathlib.Path(__file__).parent
CONTAINER='creator-contract-disposable'
info=json.loads(subprocess.check_output(['docker','inspect',CONTAINER],text=True))[0]
assert info['HostConfig']['NetworkMode']=='none','Network isolation required'
assert info['Config']['Image']=='postgres:17','Pinned major test image required'
assert not info['Mounts'] or all(m['Type']=='tmpfs' for m in info['Mounts']),'No persistent/host mounts permitted'
CMD=['docker','exec','-i',CONTAINER,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','creator_test','-d','glitch_creator_contract_test']
def sql(text,ok=True):
 p=subprocess.run(CMD,input=text,text=True,capture_output=True)
 if ok and p.returncode:raise AssertionError(p.stderr)
 return p.stdout.strip() if ok else p
assert sql("SELECT current_database()")=='glitch_creator_contract_test'
assert sql("SELECT count(*) FROM pg_tables WHERE schemaname='public'")=='0','Fresh empty database required'
sql((D/'retained-contract.sql').read_text())
M='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';A='synthetic-owner-a';B='synthetic-owner-b'
def reset():sql(f"TRUNCATE creator_intelligence_jobs; INSERT INTO creator_intelligence_jobs(mint,state,status) VALUES('{M}','{{\"retained\":true}}','partial');")
def claim(owner=A,seconds='180'):return f"SELECT claim_creator_intelligence_job('{M}',{('NULL' if owner is None else repr(owner))},{seconds});"
def save(owner=A,state='{"retained":true}',status='running',delta=1):return f"SELECT save_creator_intelligence_progress('{M}','{owner}','selling','{status}','{state}'::jsonb,{delta});"
def parallel(statements):
 with concurrent.futures.ThreadPoolExecutor(len(statements)) as pool:return list(pool.map(sql,statements))
passed=[]
def check(name,condition):assert condition,name;passed.append(name);print('PASS',name,flush=True)
reset();check('V1 different owners: one claim',sorted(parallel([claim(A),claim(B)]))==['f','t'])
reset();check('V1 same owner: both claims accepted',parallel([claim(),claim()])==['t','t'])
reset();sql(claim());check('V1 concurrent same-owner running saves both accepted',parallel([save(state='{"a":1}'),save(state='{"b":2}')])==['t','t'])
check('V1 one history overwritten and both deltas counted',sql("SELECT request_count_total=2 AND (state='{"+'"a":1' +"}'::jsonb OR state='{"+'"b":2'+"}'::jsonb) FROM creator_intelligence_jobs")=='t')
reset();sql(claim());sql(save());sql(save());check('V1 identical repeated running save double counts',sql('SELECT request_count_total FROM creator_intelligence_jobs')=='2')
reset();sql(claim());check('V1 wrong owner save rejected',sql(save(owner=B))=='f')
sql("UPDATE creator_intelligence_jobs SET lease_until=clock_timestamp()-interval '1 second'");check('V1 fresh transaction rejects expired lease',sql(save())=='f')
reset();sql(claim());sql("UPDATE creator_intelligence_jobs SET lease_until=clock_timestamp()+interval '1 second'")
result=sql('BEGIN; SELECT pg_sleep(1.2); '+save()+" SELECT lease_until<clock_timestamp() FROM creator_intelligence_jobs; COMMIT;")
check('V1 transaction-start now admits save after wall-clock expiry',result.splitlines()[-2:]==['t','t'])
reset();check('V1 NULL owner passes function validation',sql(claim(owner=None))=='t' and sql('SELECT lease_owner IS NULL AND lease_until IS NOT NULL FROM creator_intelligence_jobs')=='t')
reset();check('V1 NULL duration creates unfenced running claim',sql(claim(seconds='NULL'))=='t' and sql('SELECT lease_until IS NULL FROM creator_intelligence_jobs')=='t' and sql(claim(owner=B))=='t')
reset();sql(claim());before=sql('SELECT lease_until FROM creator_intelligence_jobs');sql(save());check('V1 running save retains but does not renew lease',sql('SELECT lease_until FROM creator_intelligence_jobs')==before)
sql(save(status='partial'));check('V1 partial save releases lease',sql('SELECT lease_owner IS NULL AND lease_until IS NULL FROM creator_intelligence_jobs')=='t')
print(json.dumps({'retained_model_passed':len(passed),'hosted_execution':False}),flush=True)
# Candidate contract is an unapplied proposal. Install ONLY in this disposable DB.
reset();before=sql('SELECT to_jsonb(j)::text FROM creator_intelligence_jobs j')
proposal=D.parents[2]/'docs'/'proposals'/'creator-job-fencing-v2.sql'
wrong_target=subprocess.run(CMD[:-1]+['postgres'],input=proposal.read_text(),text=True,capture_output=True)
check('V2 proposal rejects a different database before DDL',wrong_target.returncode!=0 and 'DISPOSABLE_CREATOR_DATABASE_REQUIRED' in wrong_target.stderr)
sql(proposal.read_text())
check('V2 adding revision preserves all existing row fields',sql("SELECT (to_jsonb(j)-'revision')::text FROM creator_intelligence_jobs j")==before)
def claim2(owner=A,revision=0,seconds=180):return f"SELECT claim_creator_intelligence_job_v2('{M}','{owner}',{revision},{seconds}) IS NOT NULL;"
def save2(owner=A,revision=1,state='{"retained":true}',status='running',delta=1):return f"SELECT save_creator_intelligence_progress_v2('{M}','{owner}',{revision},'selling','{status}','{state}'::jsonb,{delta}) IS NOT NULL;"
reset();check('V2 different-owner claims have one winner',sorted(parallel([claim2(A),claim2(B)]))==['f','t'])
reset();check('V2 same-owner claims have one winner',sorted(parallel([claim2(),claim2()]))==['f','t'])
check('V2 active same-owner reclaim rejected even with fresh revision',sql(claim2(revision=1))=='f')
reset();sql(claim2());check('V2 same-revision saves have one winner',sorted(parallel([save2(state='{"a":1}'),save2(state='{"b":2}')]))==['f','t'])
check('V2 only one request delta persists',sql('SELECT revision=2 AND request_count_total=1 FROM creator_intelligence_jobs')=='t')
check('V2 uncertain-response replay cannot overwrite or double count',sql(save2())=='f' and sql('SELECT request_count_total FROM creator_intelligence_jobs')=='1')
check('V2 correct next revision permits running progress',sql(save2(revision=2))=='t')
reset();sql(claim2());check('V2 wrong-owner save rejected',sql(save2(owner=B))=='f')
sql("UPDATE creator_intelligence_jobs SET lease_until=clock_timestamp()-interval '1 second'");check('V2 expired save rejected',sql(save2())=='f')
check('V2 expired lease can be reclaimed at expected revision',sql(claim2(owner=B,revision=1))=='t')
check('V2 stale former owner cannot overwrite reclaimed job',sql(save2())=='f')
reset();sql(claim2());sql("UPDATE creator_intelligence_jobs SET lease_until=clock_timestamp()+interval '1 second'")
result=sql('BEGIN; SELECT pg_sleep(1.2); '+save2()+" SELECT revision=1 AND request_count_total=0 FROM creator_intelligence_jobs; COMMIT;")
check('V2 wall-clock check rejects transaction-start expiry bypass',result.splitlines()[-2:]==['f','t'])
reset();sql(claim2());before=sql('SELECT lease_until FROM creator_intelligence_jobs');sql(save2());check('V2 running saves never renew or expand lease',sql('SELECT lease_until FROM creator_intelligence_jobs')==before)
sql(save2(revision=2,status='partial'));check('V2 partial commit releases lease and increments revision',sql('SELECT revision=3 AND lease_owner IS NULL AND lease_until IS NULL FROM creator_intelligence_jobs')=='t')
# NULL checks must reject before any mutation, regardless of table nullability.
base_claim=[repr(M),repr(A),'0','180'];base_save=[repr(M),repr(A),'0',"'selling'","'running'","'{}'::jsonb",'1']
for fn,args in [('claim_creator_intelligence_job_v2',base_claim),('save_creator_intelligence_progress_v2',base_save)]:
 for index in range(len(args)):
  reset();before=sql('SELECT to_jsonb(j)::text FROM creator_intelligence_jobs j');bad=args.copy();bad[index]='NULL'
  result=sql('SELECT '+fn+'('+','.join(bad)+');',False)
  check(f'V2 {fn} NULL argument {index} rejected without mutation',result.returncode!=0 and 'INVALID_CREATOR_V2_' in result.stderr and sql('SELECT to_jsonb(j)::text FROM creator_intelligence_jobs j')==before)
# Lock holder proves NOWAIT is fail-closed, with no lost updates.
reset();sql(claim2())
locker=subprocess.Popen(CMD,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
locker.stdin.write("BEGIN; SET application_name='creator_contract_lock'; SELECT mint FROM creator_intelligence_jobs FOR UPDATE; SELECT pg_sleep(2); ROLLBACK;\n");locker.stdin.close()
for _ in range(40):
 if sql("SELECT count(*) FROM pg_stat_activity WHERE application_name='creator_contract_lock' AND wait_event='PgSleep'")=='1':break
 time.sleep(.025)
else:raise AssertionError('Local lock barrier not reached')
check('V2 lock contention cannot advance checkpoint',sql(save2())=='f')
locker.wait(timeout=4);check('V2 save can proceed after lock release',sql(save2())=='t')
# A deliberately slow local trigger forces the UPDATE across wall-clock expiry.
reset();sql(claim2());sql("UPDATE creator_intelligence_jobs SET lease_until=clock_timestamp()+interval '1 second'")
sql("CREATE FUNCTION local_slow_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(1.2); RETURN NEW; END $$; CREATE TRIGGER local_slow_write BEFORE UPDATE ON creator_intelligence_jobs FOR EACH ROW EXECUTE FUNCTION local_slow_write();")
result=sql(save2(),False)
check('V2 expiry during UPDATE rolls back state and delta',result.returncode!=0 and 'CREATOR_V2_LEASE_EXPIRED' in result.stderr and sql('SELECT revision=1 AND request_count_total=0 FROM creator_intelligence_jobs')=='t')
sql('DROP TRIGGER local_slow_write ON creator_intelligence_jobs; DROP FUNCTION local_slow_write();')
reset();sql(claim2());sql('BEGIN; '+save2()+ ' ROLLBACK;');check('V2 interrupted transaction preserves checkpoint/counter/revision',sql('SELECT revision=1 AND request_count_total=0 FROM creator_intelligence_jobs')=='t')
reset();check('V2 successful compact receipt excludes raw state',sql(f"SELECT NOT (r ? 'state') AND octet_length(r::text)<512 FROM (SELECT claim_creator_intelligence_job_v2('{M}','{A}',0,180) r) q")=='t')
check('V2 cutover disables legacy calls for service role',sql("SELECT has_function_privilege('service_role','claim_creator_intelligence_job(text,text,integer)','EXECUTE') OR has_function_privilege('service_role','save_creator_intelligence_progress(text,text,text,text,jsonb,integer)','EXECUTE')")=='f')
check('V2 restricted execute privilege preserved',sql("SELECT has_function_privilege('service_role','claim_creator_intelligence_job_v2(text,text,bigint,integer)','EXECUTE') AND NOT has_function_privilege('anon','claim_creator_intelligence_job_v2(text,text,bigint,integer)','EXECUTE') AND NOT has_function_privilege('authenticated','save_creator_intelligence_progress_v2(text,text,bigint,text,text,jsonb,integer)','EXECUTE')")=='t')
for label,call in [
 ('short lease',claim2(seconds=29)),('expanded lease',claim2(seconds=181)),('negative revision',claim2(revision=-1)),('revision overflow',claim2(revision=9223372036854775807)),
 ('negative delta',save2(delta=-1)),('expanded delta',save2(delta=501)),('array state',save2(state='[]')),('JSON null state',save2(state='null')),('queued save transition',save2(status='queued'))]:
 reset();before=sql('SELECT to_jsonb(j)::text FROM creator_intelligence_jobs j');result=sql(call,False)
 check('V2 invalid '+label+' cannot mutate row',result.returncode!=0 and 'INVALID_CREATOR_V2_' in result.stderr and sql('SELECT to_jsonb(j)::text FROM creator_intelligence_jobs j')==before)
reset();sql("UPDATE creator_intelligence_jobs SET status='running',lease_owner=NULL,lease_until=clock_timestamp()+interval '30 seconds'")
check('V2 inconsistent lease metadata requires reconciliation',sql(claim2())=='f' and sql('SELECT revision FROM creator_intelligence_jobs')=='0')
reset();sql('UPDATE creator_intelligence_jobs SET revision=9007199254740992')
check('V2 revision receipt preserves integers beyond JavaScript precision',sql(f"SELECT jsonb_typeof(r->'revision')='string' AND r->>'revision'='9007199254740993' FROM (SELECT claim_creator_intelligence_job_v2('{M}','{A}',9007199254740992,180) r) q")=='t')
reset();sql('SET ROLE service_role; '+claim2());check('V2 service role can use new invoker contract',sql('SELECT revision FROM creator_intelligence_jobs')=='1')
result=sql('SET ROLE service_role; '+claim(),False);check('V2 legacy invocation denied after proposed cutover',result.returncode!=0 and 'permission denied' in result.stderr)
reset();sql(claim2());check('V2 existing 500-request delta ceiling retained',sql(save2(delta=500))=='t' and sql('SELECT request_count_total FROM creator_intelligence_jobs')=='500')
reset();sql('ALTER TABLE creator_intelligence_jobs ALTER COLUMN status DROP NOT NULL; UPDATE creator_intelligence_jobs SET status=NULL')
check('V2 NULL persisted status cannot be claimed',sql(claim2())=='f')
sql(f"UPDATE creator_intelligence_jobs SET lease_owner='{A}',lease_until=clock_timestamp()+interval '30 seconds',revision=1")
check('V2 NULL persisted status cannot be saved',sql(save2())=='f')
sql("UPDATE creator_intelligence_jobs SET status='partial'; ALTER TABLE creator_intelligence_jobs ALTER COLUMN status SET NOT NULL")
print(json.dumps({'total_checks_passed':len(passed),'hosted_execution':False,'proposal_applied_only_in_disposable_db':True}),flush=True)
