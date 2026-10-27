"""Closed setup only: disposable PG17, network none, no live bindings/credentials."""
import subprocess,pathlib,time,json
root=pathlib.Path(__file__).resolve().parents[3];name='creator-evidence-closed';db='glitch_creator_evidence_test'
assert subprocess.run(['docker','inspect',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode!=0
subprocess.run(['docker','run','--rm','--name',name,'--network','none','--tmpfs','/var/lib/postgresql/data','-e','POSTGRES_HOST_AUTH_METHOD=trust','-e','POSTGRES_USER=creator_test','-e','POSTGRES_DB='+db,'-d','postgres:17'],check=True,stdout=subprocess.DEVNULL)
cmd=['docker','exec','-i',name,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','creator_test','-d',db]
def sql(q,ok=True):
 r=subprocess.run(cmd,input=q,text=True,capture_output=True)
 if ok:assert r.returncode==0,r.stderr
 return r.stdout.strip() if ok else r
checks=0
def check(label,value):
 global checks
 assert value,label;checks+=1;print('PASS '+label,flush=True)
try:
 for _ in range(150):
  final_server=subprocess.run(['docker','exec',name,'cat','/proc/1/comm'],capture_output=True,text=True).stdout.strip()=='postgres'
  if final_server and subprocess.run(['docker','exec',name,'pg_isready','-U','creator_test','-d',db],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0:break
  time.sleep(.2)
 else:raise RuntimeError('disposable PostgreSQL did not become ready')
 candidate=(root/'docs/proposals/creator-evidence-closed-setup.sql').read_text()
 assert '{{' not in candidate
 sql('CREATE TABLE public.historical_fixture(secret text); GRANT SELECT ON public.historical_fixture TO PUBLIC;')
 check('unexpected PUBLIC history access aborts setup',sql(candidate,False).returncode!=0)
 check('failed audit rolls schema and roles back',sql("SELECT NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='creator_relay_test_private') AND NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname LIKE 'creator_test_issuer%')")=='t')
 sql('REVOKE SELECT ON public.historical_fixture FROM PUBLIC; CREATE ROLE creator_test_issuer NOLOGIN;')
 check('preexisting role causes rollback, never reused',sql(candidate,False).returncode!=0)
 check('collision preserves preexisting role and no schema',sql("SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='creator_test_issuer') AND NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='creator_relay_test_private')")=='t')
 sql('DROP ROLE creator_test_issuer; CREATE SCHEMA extensions; CREATE EXTENSION pg_stat_statements WITH SCHEMA extensions;')
 check('real statistics views retain PUBLIC SELECT without schema USAGE',sql("SELECT count(*)=2 AND bool_and(EXISTS(SELECT 1 FROM aclexplode(c.relacl) a WHERE a.grantee=0 AND a.privilege_type='SELECT')) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='extensions' AND c.relname IN('pg_stat_statements','pg_stat_statements_info')")=='t')
 sql(candidate)
 audit=candidate[candidate.index('-- Fail rather'):candidate.index('COMMIT;')]
 for view in ['pg_stat_statements','pg_stat_statements_info']:
  check(view+' table ACL is true but effective schema access false',sql("SELECT has_table_privilege('creator_test_issuer_login','extensions."+view+"','SELECT') AND NOT has_schema_privilege('creator_test_issuer_login','extensions','USAGE')")=='t')
  denied=sql('SET ROLE creator_test_issuer_login; SELECT * FROM extensions.'+view,False)
  check(view+' actual SELECT is schema-denied',denied.returncode!=0 and 'permission denied for schema extensions' in denied.stderr)
 check('later schema USAGE grant triggers the unchanged outside-access failure',sql('BEGIN; GRANT USAGE ON SCHEMA extensions TO PUBLIC;'+audit,False).returncode!=0)
 check('failed schema grant audit rolls back',sql("SELECT NOT has_schema_privilege('creator_test_issuer_login','extensions','USAGE')")=='t')
 check('accessible wrapper view is still rejected',sql('BEGIN; CREATE VIEW public.stats_wrapper AS SELECT * FROM extensions.pg_stat_statements; GRANT SELECT ON public.stats_wrapper TO PUBLIC;'+audit,False).returncode!=0)

 check('six roles created without passwords/elevated attributes',sql("SELECT count(*)=6 AND bool_and(rolpassword IS NULL AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls) FROM pg_authid WHERE rolname LIKE 'creator_test_%'")=='t')
 check('three logins have zero connection admission',sql("SELECT count(*)=3 AND bool_and(rolconnlimit=0) FROM pg_roles WHERE rolname LIKE 'creator_test_%' AND rolcanlogin")=='t')
 for role in ['issuer','consumer','verifier']:
  login='creator_test_'+role+'_login'
  result=subprocess.run(['docker','exec',name,'psql','-X','-U',login,'-d',db,'-c','SELECT 1'],text=True,capture_output=True)
  check(role+' cannot open even trust-authenticated connection',result.returncode!=0 and 'too many connections' in result.stderr)
  check(role+' cannot SET ROLE to capability role',sql('SET SESSION AUTHORIZATION '+login+'; SET ROLE creator_test_'+role,False).returncode!=0)
  check(role+' has no historical table access',sql('SET ROLE '+login+'; SELECT * FROM public.historical_fixture',False).returncode!=0)
 key='relay-tests/creator-auth-flow-v1.json';r=dict(objectKey=key,capabilityHash='a'*64,payloadSha256='c902eeb22e2fc05e6378f0c578686d991c1cc70d72aeefa61dc7ae0ffe1343dd',issuedTokenHash='c'*64,byteLength=75,commit='d'*40,runId='123456',runAttempt='1',expiresAt=int(time.time())+120)
 arg="'"+json.dumps(r)+"'::jsonb"
 reserve='SELECT creator_relay_test_private.relay_reserve('+arg+');'
 check('future-looking caller payload cannot open closed issuer',sql('SET ROLE creator_test_issuer_login;'+reserve,False).returncode!=0)
 sql('CREATE POLICY hostile_permissive ON creator_relay_test_private.relay_reservations FOR ALL TO PUBLIC USING(true) WITH CHECK(true);')
 check('restrictive guard still denies despite permissive policy',sql('SET ROLE creator_test_issuer_login;'+reserve,False).returncode!=0)
 sql(reserve)
 check('consumer cannot see admin-seeded test record',sql('SET ROLE creator_test_consumer_login; SELECT count(*) FROM creator_relay_test_private.relay_reservations')=='0')
 check('verifier cannot see admin-seeded test record',sql('SET ROLE creator_test_verifier_login; SELECT count(*) FROM creator_relay_test_private.relay_reservations')=='0')
 for role in ['issuer','consumer','verifier']:
  check(role+' cannot delete claims',sql('SET ROLE creator_test_'+role+'_login; DELETE FROM creator_relay_test_private.relay_reservations',False).returncode!=0)
 # Auth/Storage stand-in: deliberate permissive baseline tests restrictive denial.
 sql("CREATE SCHEMA auth; CREATE SCHEMA storage; CREATE ROLE authenticated NOLOGIN; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; CREATE TABLE storage.objects(bucket_id text,name text); ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY; GRANT USAGE ON SCHEMA auth,storage TO authenticated; GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated; CREATE POLICY baseline ON storage.objects FOR ALL TO authenticated USING(true) WITH CHECK(true); INSERT INTO storage.objects VALUES('creator-historical-evidence','global/history'),('creator-historical-evidence','relay-tests/creator-auth-flow-v1.json');")
 u='11111111-1111-4111-8111-111111111111';v='22222222-2222-4222-8222-222222222222';other='33333333-3333-4333-8333-333333333333'
 companion=(root/'docs/proposals/creator-evidence-closed-storage.sql.in').read_text().replace('{{UPLOAD_UID}}',u).replace('{{READ_UID}}',v)
 check('missing actual identities reject companion',sql(companion,False).returncode!=0)
 sql("INSERT INTO auth.users VALUES('"+u+"'),('"+v+"');");sql(companion)
 for uid in [u,v]:
  prefix="SET ROLE authenticated; SET request.jwt.claim.sub='"+uid+"';"
  check('closed test UID cannot read any Storage path',sql(prefix+'SELECT count(*) FROM storage.objects')=='0')
  check('closed test UID cannot upload',sql(prefix+"INSERT INTO storage.objects VALUES('creator-historical-evidence','relay-tests/creator-auth-flow-v1.json')",False).returncode!=0)
  check('closed test UID cannot delete',sql(prefix+'WITH changed AS (DELETE FROM storage.objects RETURNING *) SELECT count(*) FROM changed')=='0')
  check('closed test UID cannot update',sql(prefix+'WITH changed AS (UPDATE storage.objects SET name=name RETURNING *) SELECT count(*) FROM changed')=='0')
 check('other Storage UID access unchanged',sql("SET ROLE authenticated; SET request.jwt.claim.sub='"+other+"';SELECT count(*) FROM storage.objects")=='2')
 sql((root/'docs/proposals/creator-evidence-closed-closeout.sql').read_text())
 check('closeout disables login and removes memberships',sql("SELECT NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname LIKE 'creator_test_%_login' AND rolcanlogin) AND NOT EXISTS(SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname LIKE 'creator_test_%_login')")=='t')
 check('closeout preserves claim and Storage evidence',sql('SELECT count(*) FROM creator_relay_test_private.relay_reservations')=='1' and sql('SELECT count(*) FROM storage.objects')=='2')
 print(json.dumps(dict(passed=checks,hostedAccess=False,setupAdmission=False,storageModelOnly=True)))
finally:subprocess.run(['docker','stop',name],check=True,stdout=subprocess.DEVNULL)
