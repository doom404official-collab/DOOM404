"""Exact parent-supplied PostgREST 14.18 wrapper, synthetic data, local only.
The imported large-commit check enforces local disposable database settings.
No hosted endpoint, credential, schema or timeout setting is accessed.
"""
import runpy,os,subprocess,json,time,hashlib,pathlib
directory=pathlib.Path(__file__).resolve().parent
x=runpy.run_path(str(directory/'run-large-commit-test.py'))
def ident(n,size):return hashlib.sha512(str(n).encode()).hexdigest()[:size]
cp=x['checkpoint'];cp['signatures']={ident(i,88):'checked' for i in range(3022)}
cp['networkEvidence']['processed']={s:dict(valid=True,transferCount=5+int(i<1500)) for i,s in enumerate(cp['signatures'])}
cp['networkEvidence']['transfers']=[dict(signature=ident(i%3022,88),slot=450097547+i,outerIndex=i%10,innerIndex=i%5,programId=ident('program',44),**{'from':ident('from'+str(i%2000),44),'to':ident('to'+str(i%2000),44)},assetType='TOKEN',mint=x['mint'],amountRaw=str(12345678901234567890+i),verifiedOnChain=True,transferVerified=True,sourceTokenAccount=ident('src'+str(i%2000),44),destinationTokenAccount=ident('dst'+str(i%2000),44)) for i in range(16610)]
body=json.dumps(dict(p_job_id='11111111-1111-4111-8111-111111111111',p_worker='22222222-2222-4222-8222-222222222222',p_expected_version=2136,p_checkpoint=cp,p_summary=dict(score=None,scorePromoted=False),p_status='partial'),separators=(',',':'))
print('exact fixture request bytes',len(body))
fixture=(directory/'disposable-setup.sql').read_text();definition=fixture[fixture.index('CREATE OR REPLACE FUNCTION public.glitch_commit_holder_scan'):fixture.index('CREATE OR REPLACE FUNCTION public.glitch_finish_holder_evidence')].replace('begin\n','begin\n perform nextval(\'invocation_count\');\n',1)
query='''WITH pgrst_source AS (SELECT "pgrst_call".* FROM (SELECT $1 AS json_data) pgrst_payload, LATERAL (SELECT "p_job_id", "p_worker", "p_expected_version", "p_checkpoint", "p_summary", "p_status" FROM json_to_record(pgrst_payload.json_data) AS _("p_job_id" uuid, "p_worker" uuid, "p_expected_version" bigint, "p_checkpoint" jsonb, "p_summary" jsonb, "p_status" text) LIMIT 1) pgrst_body, LATERAL "public"."glitch_commit_holder_scan"("p_job_id" := pgrst_body."p_job_id", "p_worker" := pgrst_body."p_worker", "p_expected_version" := pgrst_body."p_expected_version", "p_checkpoint" := pgrst_body."p_checkpoint", "p_summary" := pgrst_body."p_summary", "p_status" := pgrst_body."p_status") pgrst_call) SELECT null::bigint AS total_result_set, 1 AS page_total, coalesce(json_agg(_postgrest_t)->0, 'null') AS body, nullif(current_setting('response.headers', true), '') AS response_headers, nullif(current_setting('response.status', true), '') AS response_status, '' AS response_inserted FROM (SELECT "glitch_holder_scan_jobs".* FROM "pgrst_source" AS "glitch_holder_scan_jobs" LIMIT $2 OFFSET $3) _postgrest_t'''
quoted="'"+body.replace("'","''")+"'"
setup="BEGIN; SET LOCAL statement_timeout='8s'; CREATE TEMP SEQUENCE invocation_count;"+definition+"UPDATE glitch_holder_scan_jobs SET checkpoint=("+quoted+"::jsonb->'p_checkpoint'),status='running',lease_owner='22222222-2222-4222-8222-222222222222',lease_expires_at=clock_timestamp()+interval '90 seconds',version=2136 WHERE id='11111111-1111-4111-8111-111111111111';"
sql=setup+'PREPARE exact_wrapper(json,bigint,bigint) AS '+query+';EXECUTE exact_wrapper('+quoted+",1,0); SELECT 'CHECK:'||last_value FROM invocation_count; ROLLBACK;"
t=time.monotonic();r=subprocess.run([os.environ.get('PSQL','psql'),'-X','-q','-A','-t','-v','ON_ERROR_STOP=1'],input=sql,text=True,capture_output=True)
print('Local exact-wrapper elapsed seconds:',round(time.monotonic()-t,3),'response bytes:',len(r.stdout))
assert r.returncode==0
lines=r.stdout.splitlines();row=json.loads(lines[0].split('|')[2]);assert row['version']==2137 and row['checkpoint']==cp and row['lease_owner'] is None;assert lines[1]=='CHECK:1';print('PASS exact logged prepared wrapper, single invocation, full response equality, rollback')

# Inspect local stage costs without exposing the SQL arguments or plan text.
profile=setup+'PREPARE profile_wrapper(json,bigint,bigint) AS '+query+'; EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) EXECUTE profile_wrapper('+quoted+',1,0); ROLLBACK;'
profile_result=subprocess.run([os.environ.get('PSQL','psql'),'-X','-q','-A','-t','-v','ON_ERROR_STOP=1'],input=profile,text=True,capture_output=True)
assert profile_result.returncode==0, 'Local exact-wrapper profile failed'
plan=json.loads(profile_result.stdout)[0]
def stages(node):
 result=[{key:node[key] for key in ['Node Type','Function Name','Actual Total Time','Actual Rows','Actual Loops','Shared Hit Blocks','Shared Read Blocks','Shared Dirtied Blocks'] if key in node}]
 for child in node.get('Plans',[]):result.extend(stages(child))
 return result
print('Local profile only:',json.dumps({'executionMs':plan['Execution Time'],'stages':stages(plan['Plan'])},separators=(',',':')))

# A blocked write can produce the same 57014 without a payload-size defect.
# This is a negative control, not evidence of a hosted lock at the incident time.
def execute(sql,ok=True):
 result=subprocess.run([os.environ.get('PSQL','psql'),'-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose'],input=sql,text=True,capture_output=True)
 if ok:assert result.returncode==0, 'Local SQL check failed'
 return result
original=execute("SELECT to_jsonb(j) FROM glitch_holder_scan_jobs j WHERE id='11111111-1111-4111-8111-111111111111';").stdout.strip()
fields='mint,holder_set_hash,status,checkpoint,summary,lease_owner,lease_expires_at,version,created_at,updated_at'
restore="UPDATE glitch_holder_scan_jobs SET ("+fields+")=(SELECT "+fields+" FROM jsonb_populate_record(NULL::glitch_holder_scan_jobs,'"+original.replace("'","''")+"'::jsonb)) WHERE id='11111111-1111-4111-8111-111111111111';"
lock=None
try:
 execute("UPDATE glitch_holder_scan_jobs SET status='running',lease_owner='22222222-2222-4222-8222-222222222222',lease_expires_at=clock_timestamp()+interval '90 seconds',version=2136 WHERE id='11111111-1111-4111-8111-111111111111';")
 before=execute("SELECT to_jsonb(j) FROM glitch_holder_scan_jobs j WHERE id='11111111-1111-4111-8111-111111111111';").stdout
 lock=subprocess.Popen([os.environ.get('PSQL','psql'),'-X','-q','-A','-t','-v','ON_ERROR_STOP=1'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 lock.stdin.write("BEGIN; LOCK TABLE glitch_holder_scan_jobs IN SHARE MODE; SELECT 'LOCK_READY'; SELECT pg_sleep(12); ROLLBACK;\n");lock.stdin.flush()
 assert lock.stdout.readline().strip()=='LOCK_READY'
 blocked=execute("BEGIN; SET LOCAL statement_timeout='8s'; SET LOCAL lock_timeout='8s'; PREPARE blocked_wrapper(json,bigint,bigint) AS "+query+'; EXECUTE blocked_wrapper('+quoted+',1,0); ROLLBACK;',False)
 assert blocked.returncode!=0 and '57014' in blocked.stderr and 'canceling statement due to statement timeout' in blocked.stderr
 assert 'glitch_commit_holder_scan' in blocked.stderr
 lock.communicate(timeout=20)
 after=execute("SELECT to_jsonb(j) FROM glitch_holder_scan_jobs j WHERE id='11111111-1111-4111-8111-111111111111';").stdout
 assert before==after
 print('PASS exact wrapper blocked-write control: SQLSTATE 57014 statement timeout, entire job unchanged, no retry')
finally:
 if lock is not None and lock.poll() is None:lock.communicate(timeout=20)
 # Restore only disposable fixture rows; never run this script on hosted data.
 execute(restore)
