"""Differential activation/closeout in a disposable DB only; synthetic bindings."""
import subprocess,pathlib,time,json,concurrent.futures,sys
root=pathlib.Path(__file__).resolve().parents[3];name='creator-evidence-sealed';db='glitch_creator_evidence_test'
assert subprocess.run(['docker','inspect',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode!=0
subprocess.run(['docker','run','--rm','--name',name,'--network','none','--tmpfs','/var/lib/postgresql/data','-e','POSTGRES_HOST_AUTH_METHOD=trust','-e','POSTGRES_USER=creator_test','-e','POSTGRES_DB='+db,'-d','postgres:17'],check=True,stdout=subprocess.DEVNULL)
cmd=['docker','exec','-i',name,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','creator_test','-d',db]
def sql(q,ok=True):
 r=subprocess.run(cmd,input=q,text=True,capture_output=True)
 if ok:assert r.returncode==0,r.stderr
 if not ok: assert 'syntax error' not in r.stderr, r.stderr
 return r.stdout.strip() if ok else r
checks=0
def check(label,value):
 global checks
 assert value,label;checks+=1;print('PASS '+label,flush=True)
def quote(value):return "'"+value.replace("'","''")+"'"
def arg(value):return quote(json.dumps(value))+'::jsonb'
u='11111111-1111-4111-8111-111111111111';v='22222222-2222-4222-8222-222222222222';other='33333333-3333-4333-8333-333333333333'
key='relay-tests/creator-auth-flow-v1.json';digest='c902eeb22e2fc05e6378f0c578686d991c1cc70d72aeefa61dc7ae0ffe1343dd';url='https://doom404-wallet-signal-synthetic-doom-404.vercel.app'
def binding(delay=30,duration=30):
 start=int(time.time())+delay
 m=dict(repository='doom404official-collab/DOOM404',repository_id='1405094598',repository_owner='doom404official-collab',repository_owner_id='335732040',ref='refs/heads/fix/glitch-recovery-preflight-20261027',sha='a'*40,workflow_sha='a'*40,workflow_ref='doom404official-collab/DOOM404/.github/workflows/creator-evidence-relay-test.yml@refs/heads/fix/glitch-recovery-preflight-20261027',run_id='123456',run_attempt='1',event_name='workflow_dispatch',environment='synthetic',runner_environment='github-hosted',sub='synthetic-only',audience=url+'/api/creator-evidence-test/upload',startsAt=start,expiresAt=start+duration)
 return dict(version=1,projectRef='acwmtobcbpkjfqiatyke',vercelProjectId='prj_AbsbiTw8Kc8axGpZ3FFpH9VvDS4e',deploymentId='dpl_synthetic',deploymentUrl=url,commit='a'*40,approvalRef='synthetic-not-live-approval',uploadUid=u,readUid=v,objectKey=key,payloadSha256=digest,byteLength=75,upload=m,readback={**m,'run_id':'123457','audience':url+'/api/creator-evidence-test/verify'})
body=(root/'docs/proposals/creator-evidence-sealed-transition.sql').read_text()
def transition(b):return 'BEGIN;CREATE TEMP TABLE creator_test_approved_bindings(binding jsonb NOT NULL) ON COMMIT DROP;INSERT INTO creator_test_approved_bindings VALUES('+arg(b)+');'+body
def closed():return sql("SELECT to_regclass('creator_relay_test_private.sealed_test_window') IS NULL AND (SELECT bool_and(rolconnlimit=0) FROM pg_roles WHERE rolname LIKE 'creator_test_%_login') AND (SELECT bool_and(pg_get_expr(polqual,polrelid)='false') FROM pg_policy WHERE polname='closed_setup_guard')")=='t'
def auth(uid,q):return "SET ROLE authenticated;SET request.jwt.claim.sub="+quote(uid)+';'+q
try:
 for _ in range(150):
  if subprocess.run(['docker','exec',name,'cat','/proc/1/comm'],capture_output=True,text=True).stdout.strip()=='postgres' and subprocess.run(['docker','exec',name,'pg_isready','-U','creator_test','-d',db],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0:break
  time.sleep(.2)
 else:raise RuntimeError('disposable startup timeout')
 sql((root/'docs/proposals/creator-evidence-closed-setup.sql').read_text())
 sql("CREATE SCHEMA auth;CREATE SCHEMA storage;CREATE ROLE authenticated NOLOGIN;CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;CREATE TABLE storage.objects(bucket_id text,name text,PRIMARY KEY(bucket_id,name));ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;GRANT USAGE ON SCHEMA auth,storage TO authenticated;GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated;CREATE POLICY existing_permissive ON storage.objects FOR ALL TO authenticated USING(true) WITH CHECK(true);INSERT INTO auth.users VALUES('"+u+"'),('"+v+"');INSERT INTO storage.objects VALUES('creator-historical-evidence','global/history');")
 sql((root/'docs/proposals/creator-evidence-closed-storage.sql.in').read_text().replace('{{UPLOAD_UID}}',u).replace('{{READ_UID}}',v))
 check('absent input is rejected',sql('BEGIN;'+body,False).returncode!=0 and closed())
 check('unprovisioned closed login rejects activation',sql(transition(binding()),False).returncode!=0 and closed())
 for role in ['issuer','consumer','verifier']:sql("ALTER ROLE creator_test_"+role+"_login PASSWORD 'disposable-only';")
 for label,mutate in [
  ('expired',lambda b:b['upload'].update(startsAt=int(time.time())-10,expiresAt=int(time.time())-1)),
  ('oversized',lambda b:b['upload'].update(expiresAt=b['upload']['startsAt']+301)),
  ('same run',lambda b:b['readback'].update(run_id=b['upload']['run_id'])),
  ('commit conflict',lambda b:b['upload'].update(sha='b'*40)),
  ('UID conflict',lambda b:b.update(uploadUid=other)),
  ('historical path',lambda b:b.update(objectKey='global/history')),
  ('deployment absent',lambda b:b.pop('deploymentId')),
  ('typed epoch',lambda b:b['upload'].update(startsAt=str(b['upload']['startsAt']))),
 ]:
  b=binding();mutate(b)
  result=sql(transition(b),False)
  expected={'expired':'WINDOW_NOT_FUTURE_OR_BOUNDED','oversized':'WINDOW_NOT_FUTURE_OR_BOUNDED','same run':'SEPARATE_RUNS_REQUIRED','commit conflict':'INVALID_RUN_BINDING','UID conflict':'WRONG_TEST_IDENTITIES','historical path':'INVALID_SEALED_BINDING','deployment absent':'INVALID_SEALED_BINDING','typed epoch':'INVALID_MANIFEST_TYPE'}[label]
  check(label+' fails without changing closed setup',expected in result.stderr and closed())
 # Prior observations must stop activation, never be overwritten/reset by candidate.
 sql("INSERT INTO creator_relay_test_private.relay_reservations VALUES("+quote(key)+","+arg(dict(payloadSha256=digest,byteLength=75))+",clock_timestamp()+interval '60 seconds',clock_timestamp())")
 check('prior claims reject activation intact','PRIOR_CLAIMS_REQUIRE_RECONCILIATION' in sql(transition(binding()),False).stderr and sql('SELECT count(*) FROM creator_relay_test_private.relay_reservations')=='1' and closed())
 sql('DELETE FROM creator_relay_test_private.relay_reservations') # disposable fixture reset only
 sql('ALTER POLICY closed_setup_guard ON creator_relay_test_private.relay_reservations TO creator_test_issuer')
 check('changed restrictive role coverage rejected','CLOSED_CLAIM_POLICIES_REQUIRED' in sql(transition(binding()),False).stderr and closed())
 sql('ALTER POLICY closed_setup_guard ON creator_relay_test_private.relay_reservations TO creator_test_issuer,creator_test_consumer,creator_test_verifier')
 sql('CREATE POLICY creator_test_sealed_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(false);')
 result=sql(transition(binding()),False)
 check('late policy collision rolls back all partial transition DDL','already exists' in result.stderr and closed())
 sql('DROP POLICY creator_test_sealed_insert ON storage.objects;')
 b=binding(delay=5,duration=15)
 # Exercise renderer too; it emits SQL only and does not connect.
 rendered=subprocess.run(['node','--input-type=module','-e',"import {readFileSync} from 'node:fs';import {renderCreatorSealedTransition} from './lib/creatorEvidenceSealedBinding.mjs';process.stdout.write(renderCreatorSealedTransition(JSON.parse(readFileSync(0,'utf8'))));"],cwd=root,input=json.dumps(b),text=True,capture_output=True,check=True).stdout
 with concurrent.futures.ThreadPoolExecutor(2) as pool:out=list(pool.map(lambda _:sql(rendered,False),range(2)))
 if not any(x.returncode==0 for x in out):raise AssertionError(out[0].stderr)
 check('concurrent transitions admit exactly one seal',sum(x.returncode==0 for x in out)==1)
 sealed=sql('SELECT binding::text FROM creator_relay_test_private.sealed_test_window')
 check('same binding replay rejected',sql(transition(b),False).returncode!=0)
 conflict=binding();conflict['deploymentId']='dpl_different';check('conflicting future binding rejected',sql(transition(conflict),False).returncode!=0)
 r=dict(objectKey=key,capabilityHash='c'*64,payloadSha256=digest,issuedTokenHash='d'*64,byteLength=75,commit='a'*40,runId='123456',runAttempt='1',expiresAt=b['upload']['expiresAt']);c={**r,'tokenHash':'e'*64}
 reserve='SELECT creator_relay_test_private.relay_reserve('+arg(r)+');'
 check('claim denied before window',sql('SET ROLE creator_test_issuer_login;'+reserve,False).returncode!=0)
 insert="INSERT INTO storage.objects VALUES('creator-historical-evidence',"+quote(key)+');'
 check('Storage upload denied before window',sql(auth(u,insert),False).returncode!=0)
 while time.time()<b['upload']['startsAt']+.1:time.sleep(.05)
 check('sealed run can reserve once',sql('SET ROLE creator_test_issuer_login;'+reserve)=='t')
 consume='SET ROLE creator_test_consumer_login;SELECT creator_relay_test_private.relay_consume('+arg(c)+') IS NOT NULL;'
 with concurrent.futures.ThreadPoolExecutor(2) as pool:used=list(pool.map(sql,[consume,consume]))
 check('concurrent claims consume once',sorted(used)==['f','t'])
 read='SET ROLE creator_test_verifier_login;SELECT creator_relay_test_private.relay_readback('+arg(c)+','+str(b['readback']['expiresAt'])+') IS NOT NULL;'
 with concurrent.futures.ThreadPoolExecutor(2) as pool:used=list(pool.map(sql,[read,read]))
 check('separate verifier claim consumed once',sorted(used)==['f','t'])
 check('fixed upload allowed',sql(auth(u,insert),False).returncode==0)
 check('duplicate upload cannot overwrite',sql(auth(u,insert),False).returncode!=0)
 check('uploader cannot read even under existing permissive policy',sql(auth(u,'SELECT count(*) FROM storage.objects'))=='0')
 check('reader sees only test object',sql(auth(v,'SELECT count(*) FROM storage.objects'))=='1')
 check('reader cannot upload',sql(auth(v,insert),False).returncode!=0)
 check('uploader cannot access historical prefix',sql(auth(u,"INSERT INTO storage.objects VALUES('creator-historical-evidence','global/new')"),False).returncode!=0)
 for uid in [u,v]:
  for verb in ['UPDATE storage.objects SET name=name','DELETE FROM storage.objects']:
   check('test identities cannot '+verb.split()[0],sql(auth(uid,'WITH changed AS ('+verb+' RETURNING *) SELECT count(*) FROM changed'))=='0')
 check('unrelated identity/policy unchanged',sql(auth(other,'SELECT count(*) FROM storage.objects'))=='2')
 check('seal is inaccessible to test login',sql('SET ROLE creator_test_issuer_login;SELECT * FROM creator_relay_test_private.sealed_test_window',False).returncode!=0)
 before=sql("SELECT md5(string_agg(record::text,'')) FROM creator_relay_test_private.relay_reservations")
 if '--early-closeout' not in sys.argv:
  while time.time()<b['readback']['expiresAt']+.1:time.sleep(.05)
  check('expiry denies read access',sql(auth(v,'SELECT count(*) FROM storage.objects'))=='0')
  check('expiry denies upload',sql(auth(u,insert),False).returncode!=0)
  check('expiry denies claim read',sql('SET ROLE creator_test_consumer_login;SELECT count(*) FROM creator_relay_test_private.relay_reservations')=='0')
 closeout=(root/'docs/proposals/creator-evidence-sealed-closeout.sql').read_text()
 with concurrent.futures.ThreadPoolExecutor(2) as pool:list(pool.map(sql,[closeout,closeout]))
 check('closeout denies Storage reads',sql(auth(v,'SELECT count(*) FROM storage.objects'))=='0')
 check('closeout denies Storage writes',sql(auth(u,insert),False).returncode!=0)
 check('closeout disables logins',sql("SELECT bool_and(NOT rolcanlogin AND rolconnlimit=0) FROM pg_roles WHERE rolname LIKE 'creator_test_%_login'")=='t')
 check('closeout preserves immutable seal',sql('SELECT binding::text FROM creator_relay_test_private.sealed_test_window')==sealed)
 check('closeout records one stable closure',sql('SELECT closed_at IS NOT NULL FROM creator_relay_test_private.sealed_test_window')=='t')
 check('claims and stored objects are preserved',sql("SELECT md5(string_agg(record::text,'')) FROM creator_relay_test_private.relay_reservations")==before and sql('SELECT count(*) FROM storage.objects')=='2')
 check('closed seal cannot be reopened',sql(transition(binding()),False).returncode!=0)
 print(json.dumps(dict(passed=checks,hostedAccess=False,syntheticBindings=True,storageModelOnly=True)))
finally:subprocess.run(['docker','stop',name],check=True,stdout=subprocess.DEVNULL)
