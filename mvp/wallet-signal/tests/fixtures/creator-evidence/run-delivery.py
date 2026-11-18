"""Differential activation/closeout in a disposable DB only; synthetic bindings."""
import subprocess,pathlib,time,json,concurrent.futures,sys
root=pathlib.Path(__file__).resolve().parents[3];name='creator-runtime-delivery';db='glitch_creator_evidence_test'
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

try:
 for _ in range(150):
  if subprocess.run(['docker','exec',name,'cat','/proc/1/comm'],capture_output=True,text=True).stdout.strip()=='postgres' and subprocess.run(['docker','exec',name,'pg_isready','-U','creator_test','-d',db],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0:break
  time.sleep(.2)
 else:raise RuntimeError('disposable startup timeout')
 sql((root/'docs/proposals/creator-evidence-closed-setup.sql').read_text())
 sql('CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN; CREATE TABLE creator_relay_test_private.sealed_test_window(singleton boolean PRIMARY KEY,binding jsonb NOT NULL,closed_at timestamptz); ALTER TABLE creator_relay_test_private.sealed_test_window ENABLE ROW LEVEL SECURITY;')
 # Supabase-style installation identity: existing objects transferred by fixture
 # bootstrap only; candidate itself runs as actual nonsuperuser postgres session.
 sql("CREATE ROLE postgres LOGIN NOSUPERUSER CREATEROLE CREATEDB BYPASSRLS INHERIT; ALTER DATABASE "+db+" OWNER TO postgres; ALTER SCHEMA creator_relay_test_private OWNER TO postgres;")
 sql("DO $$ DECLARE r record; BEGIN FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='creator_relay_test_private' AND c.relkind='r' LOOP EXECUTE format('ALTER TABLE creator_relay_test_private.%I OWNER TO postgres',r.relname); END LOOP; FOR r IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='creator_relay_test_private' LOOP EXECUTE format('ALTER FUNCTION %s OWNER TO postgres',r.signature); END LOOP; END $$;")
 for role in ['issuer','consumer','verifier']:
  for suffix in ['', '_login']:sql('GRANT creator_test_'+role+suffix+' TO postgres WITH ADMIN TRUE, INHERIT FALSE, SET FALSE')
 cmd[cmd.index('-U')+1]='postgres'
 check('installer is nonsuperuser CREATEROLE CREATEDB BYPASSRLS postgres',sql("SELECT current_user='postgres' AND session_user='postgres' AND NOT rolsuper AND rolcreaterole AND rolcreatedb AND rolbypassrls FROM pg_roles WHERE rolname=current_user")=='t')
 sql('ALTER DEFAULT PRIVILEGES GRANT ALL ON TABLES TO anon,authenticated,service_role; ALTER DEFAULT PRIVILEGES GRANT ALL ON SEQUENCES TO anon,authenticated,service_role; ALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO anon,authenticated,service_role;')
 b=binding(delay=60,duration=30)
 sql('INSERT INTO creator_relay_test_private.sealed_test_window VALUES(true,'+arg(b)+',NULL)')
 p=dict(sealedBinding=b,storageSessions=dict(upload='synthetic.upload.token',readback='synthetic.readback.token'),publishableKey='sb_publishable_synthetic')
 candidate=(root/'docs/proposals/creator-evidence-runtime-delivery.sql').read_text()
 check('missing secure input rejects',sql(candidate,False).returncode!=0)
 def install(payload):return 'CREATE TEMP TABLE creator_test_runtime_input(payload jsonb);INSERT INTO creator_test_runtime_input VALUES('+arg(payload)+');'+candidate
 wrong={**p,'sealedBinding':{**b,'commit':'b'*40}}
 check('mismatched seal rejects',sql(install(wrong),False).returncode!=0)
 check('rejection leaves delivery absent',sql("SELECT to_regclass('creator_relay_test_private.runtime_delivery') IS NULL")=='t')
 sql(install(p));check('exact delivery installs once',True)
 check('delivery owner and security definer are nonsuperuser postgres',sql("SELECT (SELECT tableowner='postgres' FROM pg_tables WHERE schemaname='creator_relay_test_private' AND tablename='runtime_delivery') AND (SELECT proowner='postgres'::regrole AND prosecdef AND proconfig=ARRAY['search_path=pg_catalog, creator_relay_test_private'] FROM pg_proc WHERE oid='creator_relay_test_private.relay_runtime_configuration(jsonb)'::regprocedure)")=='t')
 for denied in ['anon','authenticated','service_role']:
  check(denied+' default table/function grants explicitly removed',sql("SELECT NOT has_table_privilege('"+denied+"','creator_relay_test_private.runtime_delivery','SELECT,INSERT,UPDATE,DELETE') AND NOT has_function_privilege('"+denied+"','creator_relay_test_private.relay_runtime_configuration(jsonb)','EXECUTE')")=='t')
 check('postgres retains only expected administrative membership options',sql("SELECT count(*)=6 AND bool_and(admin_option AND NOT inherit_option AND NOT set_option) FROM pg_auth_members WHERE member='postgres'::regrole")=='t')
 check('reinstall rejects, never overwrite',sql(install(p),False).returncode!=0)
 roles=['issuer','consumer','verifier']
 for role in roles:sql('ALTER ROLE creator_test_'+role+'_login CONNECTION LIMIT 1')
 def call(role,identity):
  c=cmd.copy();c[c.index('-U')+1]='creator_test_'+role+'_login'
  return subprocess.run(c,input='SELECT creator_relay_test_private.relay_runtime_configuration('+arg(identity)+')',text=True,capture_output=True)
 d=dict(target='preview',projectId=b['vercelProjectId'],id=b['deploymentId'],url=b['deploymentUrl'],commit=b['commit'],branch='fix/glitch-recovery-preflight-20261027',action='issue')
 check('before window returns no credentials',call('issuer',d).stdout.strip()=='')
 # Synthetic fixture clock positioning only; never edits hosted bindings.
 def set_times(start,end):
  for phase in ['upload','readback']:b[phase]['startsAt']=start;b[phase]['expiresAt']=end
  p['sealedBinding']=b
  sql('UPDATE creator_relay_test_private.sealed_test_window SET binding='+arg(b)+';UPDATE creator_relay_test_private.runtime_delivery SET payload='+arg(p))
 set_times(int(time.time())-1,int(time.time())+60)
 check('issuer reads matching upload configuration',json.loads(call('issuer',d).stdout)==dict(sealedBinding=b,phase='upload',storageSessions=dict(upload=p['storageSessions']['upload']),publishableKey=p['publishableKey']))
 check('verifier reads matching readback configuration',json.loads(call('verifier',{**d,'action':'verify'}).stdout)==dict(sealedBinding=b,phase='readback',storageSessions=dict(readback=p['storageSessions']['readback']),publishableKey=p['publishableKey']))
 check('issuer cannot use readback phase',call('issuer',{**d,'action':'verify'}).stdout.strip()=='')
 check('verifier cannot use upload phase',call('verifier',d).stdout.strip()=='')
 check('consumer has no configuration privilege',call('consumer',d).returncode!=0)
 for field in ['target','projectId','id','url','commit','branch']:
  check('wrong deployment '+field+' returns no configuration',call('issuer',{**d,field:'wrong'}).stdout.strip()=='')
 for role in roles:
  for action in ['SELECT * FROM','UPDATE']:
   q='SELECT * FROM creator_relay_test_private.runtime_delivery' if action.startswith('SELECT') else "UPDATE creator_relay_test_private.runtime_delivery SET payload='{}'"
   c=cmd.copy();c[c.index('-U')+1]='creator_test_'+role+'_login'
   check(role+' direct '+action+' denied',subprocess.run(c,input=q,text=True,capture_output=True).returncode!=0)
 set_times(int(time.time())-10,int(time.time())-1)
 check('expired configuration unavailable',call('issuer',d).stdout.strip()=='')
 set_times(int(time.time())-1,int(time.time())+60);sql('UPDATE creator_relay_test_private.sealed_test_window SET closed_at=clock_timestamp()')
 check('closeout blocks configuration without deleting audit record',call('issuer',d).stdout.strip()=='' and sql('SELECT count(*) FROM creator_relay_test_private.runtime_delivery')=='1')
 print('CREATOR_DELIVERY_SQL_CHECKS='+str(checks))
finally:
 subprocess.run(['docker','rm','-f',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
