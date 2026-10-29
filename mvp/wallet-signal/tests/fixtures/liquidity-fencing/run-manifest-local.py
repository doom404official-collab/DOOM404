"""Exact unapproved retained-admin alternative replay; only owned network-none disposable Docker.
No connection parameters accepted. Bootstrap is local only; replay uses a real
postgres login with CREATEROLE with CREATEDB/BYPASSRLS/INHERIT, but no SUPERUSER.
"""
import pathlib,subprocess,time,uuid,shutil
ROOT=pathlib.Path(__file__).resolve().parents[3]
name='lq-hosted-replay-'+uuid.uuid4().hex[:10]; container=None; count=0
def cmd(a,**kw):return subprocess.run(a,text=True,capture_output=True,timeout=40,**kw)
try:
 p=cmd(['docker','run','--pull=never','--rm','-d','--name',name,'--network','none','--add-host','db.acwmtobcbpkjfqiatyke.supabase.co:127.0.0.1','--mount',f'type=bind,source={ROOT},target=/app,readonly','--mount',f'type=bind,source={pathlib.Path(shutil.which("node")).resolve()},target=/usr/local/bin/node,readonly','--tmpfs','/var/lib/postgresql/data:rw','-e','POSTGRES_HOST_AUTH_METHOD=trust','-e','POSTGRES_USER=fixture_bootstrap','-e','POSTGRES_DB=postgres','postgres:17']);assert p.returncode==0,p.stderr;container=p.stdout.strip()
 def sql(q,ok=True,role='postgres'):
  p=cmd(['docker','exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U',role,'-d','postgres'],input=q)
  if ok:assert p.returncode==0,p.stderr
  return p.stdout.strip() if ok else p
 def check(c,label):
  global count
  assert c,label;count+=1;print('PASS',label,flush=True)
 for _ in range(100):
  if 'PostgreSQL init process complete' in cmd(['docker','logs',container]).stdout and sql('SELECT 1',False,'fixture_bootstrap').returncode==0:break
  time.sleep(.1)
 else:raise AssertionError('LOCAL_DB_NOT_READY')
 sql('CREATE ROLE postgres LOGIN CREATEROLE NOSUPERUSER BYPASSRLS CREATEDB INHERIT; ALTER DATABASE postgres OWNER TO postgres; ALTER SCHEMA public OWNER TO postgres; CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;',role='fixture_bootstrap')
 for f in ['liquidity_evidence.sql','liquidity_evidence_snapshots.sql']:sql((ROOT/'supabase'/f).read_text())
 sql("GRANT ALL ON public.liquidity_evidence_checkpoints,public.liquidity_evidence_snapshots TO service_role; GRANT SELECT,USAGE,UPDATE ON public.liquidity_evidence_snapshots_id_seq TO anon,authenticated,service_role; ALTER DEFAULT PRIVILEGES GRANT ALL ON TABLES TO anon,authenticated,service_role; ALTER DEFAULT PRIVILEGES GRANT ALL ON SEQUENCES TO anon,authenticated,service_role; ALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO anon,authenticated,service_role; INSERT INTO public.liquidity_evidence_checkpoints(mint,status,observed_at,evidence) VALUES(repeat('1',32),'partial',clock_timestamp(),'{\"synthetic\":true}');")
 baseline=sql('SELECT row_to_json(t) FROM public.liquidity_evidence_checkpoints t')
 candidate=(ROOT/'docs/proposals/liquidity-hosted-retained-admin-alternative.sql').read_text()
 sql(candidate)
 extension=(ROOT/'docs/proposals/liquidity-inactive/manifest-reader.sql').read_text()
 check(sql(extension,False,'fixture_bootstrap').returncode!=0,'reader rejects wrong installer')
 sql('GRANT liquidity_fencing_executor TO anon WITH ADMIN FALSE, INHERIT FALSE, SET FALSE')
 check(sql(extension,False).returncode!=0,'reader rejects unexpected membership')
 sql('REVOKE liquidity_fencing_executor FROM anon')
 broken=extension.rsplit('COMMIT;',1)[0]+"DO $$ BEGIN RAISE EXCEPTION 'ROLLBACK_TEST'; END $$; COMMIT;"
 check(sql(broken,False).returncode!=0,'injected post-install failure rolls back')
 check(sql("SELECT to_regprocedure('liquidity_fencing_private.read_manifest(uuid)') IS NULL")=='t','reader absent after rollback')
 sql(extension)
 check(True,'exact extension commits under nonsuperuser administrator')
 check(sql(extension,False).returncode!=0,'extension replay rejected')
 for role in ['anon','authenticated','service_role']:
  check(sql("SELECT has_function_privilege('"+role+"','liquidity_fencing_private.read_manifest(uuid)','EXECUTE')")=='f',role+' cannot read manifest')
 check(sql("SELECT count(*) FROM pg_auth_members WHERE roleid IN ('liquidity_fencing_code_owner'::regrole,'liquidity_fencing_executor'::regrole,'liquidity_fencing_reviewer'::regrole) AND member='postgres'::regrole AND grantor=10 AND admin_option AND NOT inherit_option AND NOT set_option")=='3','temporary authority removed')
 check(sql('SELECT row_to_json(t) FROM public.liquidity_evidence_checkpoints t')==baseline,'legacy evidence unchanged')
 # Local fixture-only TLS/login setup; never part of either proposal.
 cmd(['docker','exec',container,'sh','-c',"openssl req -x509 -newkey rsa:2048 -nodes -keyout /var/lib/postgresql/data/runtime.key -out /var/lib/postgresql/data/runtime.crt -days 1 -subj /CN=db.acwmtobcbpkjfqiatyke.supabase.co -addext subjectAltName=DNS:db.acwmtobcbpkjfqiatyke.supabase.co >/dev/null 2>&1 && chown postgres:postgres /var/lib/postgresql/data/runtime.* && chmod 600 /var/lib/postgresql/data/runtime.key"]).check_returncode()
 for q in ["ALTER SYSTEM SET ssl='on'","ALTER SYSTEM SET ssl_cert_file='runtime.crt'","ALTER SYSTEM SET ssl_key_file='runtime.key'"]:sql(q,role='fixture_bootstrap')
 for role in ['postgres','liquidity_fencing_executor','liquidity_fencing_reviewer']:sql('ALTER ROLE '+role+" LOGIN CONNECTION LIMIT 10 PASSWORD 'synthetic-only'",role='fixture_bootstrap')
 cmd(['docker','exec',container,'sh','-c',"printf 'hostssl all all 127.0.0.1/32 scram-sha-256\n' > /tmp/hba && cat /var/lib/postgresql/data/pg_hba.conf >> /tmp/hba && cat /tmp/hba > /var/lib/postgresql/data/pg_hba.conf"]).check_returncode()
 sql('SELECT pg_reload_conf()',role='fixture_bootstrap')
 p=cmd(['docker','exec',container,'node','/app/tests/fixtures/liquidity-fencing/manifest-runtime.mjs']);print(p.stdout,flush=True);assert p.returncode==0,p.stderr
 print('MANIFEST_SETUP_CHECKS='+str(count))
finally:
 if container:cmd(['docker','rm','-f',container])
