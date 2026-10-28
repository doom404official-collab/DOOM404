"""Exact unapplied hosted SQL replay; only owned network-none disposable Docker.
No connection parameters accepted. Bootstrap is local only; replay uses a real
postgres login with CREATEROLE but no SUPERUSER/BYPASSRLS/CREATEDB.
"""
import pathlib,subprocess,time,uuid
ROOT=pathlib.Path(__file__).resolve().parents[3]
name='lq-hosted-replay-'+uuid.uuid4().hex[:10]; container=None; count=0
def cmd(a,**kw):return subprocess.run(a,text=True,capture_output=True,timeout=40,**kw)
try:
 p=cmd(['docker','run','--pull=never','--rm','-d','--name',name,'--network','none','--tmpfs','/var/lib/postgresql/data:rw','-e','POSTGRES_HOST_AUTH_METHOD=trust','-e','POSTGRES_USER=fixture_bootstrap','-e','POSTGRES_DB=postgres','postgres:17']);assert p.returncode==0,p.stderr;container=p.stdout.strip()
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
 sql('CREATE ROLE postgres LOGIN CREATEROLE NOSUPERUSER NOBYPASSRLS NOCREATEDB; ALTER DATABASE postgres OWNER TO postgres; ALTER SCHEMA public OWNER TO postgres; CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;',role='fixture_bootstrap')
 for f in ['liquidity_evidence.sql','liquidity_evidence_snapshots.sql']:sql((ROOT/'supabase'/f).read_text())
 sql("GRANT ALL ON public.liquidity_evidence_checkpoints,public.liquidity_evidence_snapshots TO service_role; GRANT SELECT,USAGE,UPDATE ON public.liquidity_evidence_snapshots_id_seq TO anon,authenticated,service_role; ALTER DEFAULT PRIVILEGES GRANT ALL ON TABLES TO anon,authenticated,service_role; ALTER DEFAULT PRIVILEGES GRANT ALL ON SEQUENCES TO anon,authenticated,service_role; ALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO anon,authenticated,service_role; INSERT INTO public.liquidity_evidence_checkpoints(mint,status,observed_at,evidence) VALUES(repeat('1',32),'partial',clock_timestamp(),'{\"synthetic\":true}');")
 baseline=sql('SELECT row_to_json(t) FROM public.liquidity_evidence_checkpoints t')
 candidate=(ROOT/'docs/proposals/liquidity-hosted-closed-setup.sql').read_text()
 check(sql("SELECT NOT rolsuper AND NOT rolbypassrls AND NOT rolcreatedb AND rolcreaterole FROM pg_roles WHERE rolname=current_user")=='t','real nonsuperuser admin session')
 check(sql(candidate,False,'fixture_bootstrap').returncode!=0,'unexpected session rejected')
 sql('CREATE ROLE liquidity_fencing_executor NOLOGIN')
 check(sql(candidate,False).returncode!=0,'preexisting role rejected before mutations')
 sql('DROP ROLE liquidity_fencing_executor')
 sql('CREATE SCHEMA liquidity_fencing_private')
 check(sql(candidate,False).returncode!=0,'preexisting schema rejected')
 sql('DROP SCHEMA liquidity_fencing_private')
 sql('GRANT SELECT ON public.liquidity_evidence_checkpoints TO anon')
 check(sql(candidate,False).returncode!=0,'legacy unexpected grant rejected')
 sql('REVOKE SELECT ON public.liquidity_evidence_checkpoints FROM anon')
 p=sql(candidate,False)
 check(p.returncode!=0 and 'MEMBERSHIP_CREATE_POSTCONDITION' in p.stderr,'nonsuperuser exact SQL fails closed on bootstrap-granted membership')
 check(sql("SELECT count(*) FROM pg_namespace WHERE nspname='liquidity_fencing_private'")=='0','rollback removes schema')
 check(sql("SELECT count(*) FROM pg_roles WHERE rolname LIKE 'liquidity_fencing_%'")=='0','rollback removes roles/memberships')
 check(sql("SELECT has_sequence_privilege('anon','public.liquidity_evidence_snapshots_id_seq','UPDATE')")=='t','rollback restores sequence ACL')
 sql('CREATE ROLE lq_membership_probe NOLOGIN')
 check(sql('REVOKE lq_membership_probe FROM postgres GRANTED BY fixture_bootstrap',False).returncode!=0,'nonsuperuser cannot impersonate bootstrap grantor to remove implicit admin grant')
 sql('DROP ROLE lq_membership_probe',role='fixture_bootstrap')
 # Comparison only: local bootstrap elevates this SYNTHETIC admin to establish
 # SQL correctness, not to assume or request hosted superuser capability.
 sql('ALTER ROLE postgres SUPERUSER',role='fixture_bootstrap')
 fail=candidate.rsplit('COMMIT;',1)[0]+"DO $$ BEGIN RAISE EXCEPTION 'INJECTED'; END $$; COMMIT;"
 p=sql(fail,False)
 check(p.returncode!=0 and 'INJECTED' in p.stderr,'superuser comparison reaches injected end failure')
 check(sql("SELECT count(*) FROM pg_roles WHERE rolname LIKE 'liquidity_fencing_%'")=='0','comparison rollback removes roles')
 sql(candidate)
 check(True,'exact SQL commits only in explicitly superuser comparison fixture')
 check(sql("SELECT count(*) FROM pg_authid WHERE rolname LIKE 'liquidity_fencing_%' AND NOT rolcanlogin AND rolpassword IS NULL AND rolconnlimit=0",role='fixture_bootstrap')=='3','local privileged audit confirms passwordless closed roles')
 check(sql("SELECT count(*) FROM pg_auth_members WHERE roleid IN (SELECT oid FROM pg_roles WHERE rolname LIKE 'liquidity_fencing_%') OR member IN (SELECT oid FROM pg_roles WHERE rolname LIKE 'liquidity_fencing_%')")=='0','temporary ownership-transfer memberships removed')
 check(sql('SELECT row_to_json(t) FROM public.liquidity_evidence_checkpoints t')==baseline,'legacy rows unchanged')
 check(sql(candidate,False).returncode!=0,'postcommit replay rejected')
 print('HOSTED_CANDIDATE_LOCAL_CHECKS='+str(count))
finally:
 if container:cmd(['docker','rm','-f',container])
