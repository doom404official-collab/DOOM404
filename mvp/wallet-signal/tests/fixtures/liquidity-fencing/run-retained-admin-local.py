"""Exact unapproved retained-admin alternative replay; only owned network-none disposable Docker.
No connection parameters accepted. Bootstrap is local only; replay uses a real
postgres login with CREATEROLE with CREATEDB/BYPASSRLS/INHERIT, but no SUPERUSER.
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
 sql('CREATE ROLE postgres LOGIN CREATEROLE NOSUPERUSER BYPASSRLS CREATEDB INHERIT; ALTER DATABASE postgres OWNER TO postgres; ALTER SCHEMA public OWNER TO postgres; CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;',role='fixture_bootstrap')
 for f in ['liquidity_evidence.sql','liquidity_evidence_snapshots.sql']:sql((ROOT/'supabase'/f).read_text())
 sql("GRANT ALL ON public.liquidity_evidence_checkpoints,public.liquidity_evidence_snapshots TO service_role; GRANT SELECT,USAGE,UPDATE ON public.liquidity_evidence_snapshots_id_seq TO anon,authenticated,service_role; ALTER DEFAULT PRIVILEGES GRANT ALL ON TABLES TO anon,authenticated,service_role; ALTER DEFAULT PRIVILEGES GRANT ALL ON SEQUENCES TO anon,authenticated,service_role; ALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO anon,authenticated,service_role; INSERT INTO public.liquidity_evidence_checkpoints(mint,status,observed_at,evidence) VALUES(repeat('1',32),'partial',clock_timestamp(),'{\"synthetic\":true}');")
 baseline=sql('SELECT row_to_json(t) FROM public.liquidity_evidence_checkpoints t')
 candidate=(ROOT/'docs/proposals/liquidity-hosted-retained-admin-alternative.sql').read_text()
 check(sql("SELECT NOT rolsuper AND rolbypassrls AND rolcreatedb AND rolcreaterole AND rolinherit FROM pg_roles WHERE rolname=current_user")=='t','real nonsuperuser admin session')
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
 # Local-only fault injection: owned bootstrap fixture, never part of candidate.
 sql("CREATE FUNCTION public.fixture_fault(text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN EXECUTE $1; END $$; GRANT EXECUTE ON FUNCTION public.fixture_fault(text) TO postgres",role='fixture_bootstrap')
 marker='DO $$ DECLARE t text; n bigint; r record; BEGIN'
 faults={
  'unexpected member':"GRANT liquidity_fencing_executor TO anon WITH ADMIN FALSE, INHERIT FALSE, SET FALSE",
  'unexpected grantor':"UPDATE pg_auth_members SET grantor='postgres'::regrole WHERE roleid='liquidity_fencing_executor'::regrole",
  'unexpected SET':"UPDATE pg_auth_members SET set_option=true WHERE roleid='liquidity_fencing_executor'::regrole",
  'unexpected INHERIT':"UPDATE pg_auth_members SET inherit_option=true WHERE roleid='liquidity_fencing_executor'::regrole",
  'missing ADMIN':"UPDATE pg_auth_members SET admin_option=false WHERE roleid='liquidity_fencing_executor'::regrole",
  'runtime role membership':"GRANT anon TO liquidity_fencing_executor",
 }
 for label,fault in faults.items():
  broken=candidate.replace(marker,"SELECT public.fixture_fault($fault$"+fault+"$fault$);\n"+marker)
  p=sql(broken,False)
  check(p.returncode!=0 and 'EXACT_RETAINED_ADMIN_POSTCONDITION' in p.stderr,label+' rejected by exact postcondition')
  check(sql("SELECT count(*) FROM pg_roles WHERE rolname LIKE 'liquidity_fencing_%'")=='0',label+' transaction rolls back roles')
  check(sql("SELECT has_sequence_privilege('anon','public.liquidity_evidence_snapshots_id_seq','UPDATE')")=='t',label+' rollback preserves sequence ACL')
 fail=candidate.rsplit('COMMIT;',1)[0]+"DO $$ BEGIN RAISE EXCEPTION 'INJECTED'; END $$; COMMIT;"
 p=sql(fail,False)
 check(p.returncode!=0 and 'INJECTED' in p.stderr,'realistic admin reaches end-of-transaction rollback injection')
 check(sql("SELECT count(*) FROM pg_namespace WHERE nspname='liquidity_fencing_private'")=='0','end failure leaves no private schema')
 sql(candidate)
 check(True,'exact alternative commits under realistic nonsuperuser administrator')
 check(sql("SELECT count(*) FROM pg_auth_members WHERE roleid IN (SELECT oid FROM pg_roles WHERE rolname LIKE 'liquidity_fencing_%') AND member='postgres'::regrole AND grantor=10::oid AND admin_option AND NOT inherit_option AND NOT set_option")=='3','exact three bootstrap ADMIN-only memberships')
 check(sql("SELECT count(*) FROM pg_authid WHERE rolname LIKE 'liquidity_fencing_%' AND NOT rolcanlogin AND rolpassword IS NULL AND rolconnlimit=0 AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole",role='fixture_bootstrap')=='3','three closed passwordless non-administrative runtime/code roles')
 for role in ['liquidity_fencing_code_owner','liquidity_fencing_executor','liquidity_fencing_reviewer']:
  check(sql('SET ROLE '+role,False).returncode!=0,'administrator cannot accidentally SET '+role)
 for role in ['liquidity_fencing_executor','liquidity_fencing_reviewer']:
  for action in ["UPDATE liquidity_fencing_private.lane SET epoch=99", "GRANT liquidity_fencing_executor TO anon", "SET ROLE postgres"]:
   check(sql('SET SESSION AUTHORIZATION '+role+'; '+action,False,'fixture_bootstrap').returncode!=0,'runtime denied '+action.split()[0]+': '+role)
 check(sql('SELECT row_to_json(t) FROM public.liquidity_evidence_checkpoints t')==baseline,'legacy data unchanged')
 check(sql(candidate,False).returncode!=0,'postcommit replay fails closed')
 # Demonstrate trusted-admin boundary honestly, in this local fixture only.
 sql('GRANT liquidity_fencing_executor TO postgres WITH INHERIT FALSE, SET TRUE; SET ROLE liquidity_fencing_executor; RESET ROLE; REVOKE liquidity_fencing_executor FROM postgres')
 check(True,'ADMIN can deliberately regrant SET: not a malicious-admin defense')
 check(sql("SELECT count(*) FROM pg_auth_members WHERE roleid='liquidity_fencing_executor'::regrole AND member='postgres'::regrole AND grantor=10::oid AND NOT set_option AND NOT inherit_option")=='1','local boundary demonstration restores exact membership')
 print('RETAINED_ADMIN_LOCAL_CHECKS='+str(count))
finally:
 if container:cmd(['docker','rm','-f',container])
