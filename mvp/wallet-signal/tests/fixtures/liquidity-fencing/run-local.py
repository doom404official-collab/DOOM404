"""Disposable PostgreSQL 17 contract tests. No hosted connection, ports or secrets.
Uses only an already-present Docker image, with networking disabled; owns/removes
only the container it creates. Candidate SQL is guarded to this test DB/user.
"""
import pathlib, subprocess, uuid, time, concurrent.futures
ROOT=pathlib.Path(__file__).resolve().parents[3]
NAME='liquidity-fencing-test-'+uuid.uuid4().hex[:12]
DB='glitch_liquidity_fencing_test'
USER='liquidity_local_owner'
def cmd(args,**kw):
 return subprocess.run(args,text=True,capture_output=True,timeout=40,**kw)
container=None
checks=0
try:
 p=cmd(['docker','run','--pull=never','--rm','-d','--name',NAME,'--network','none','--tmpfs','/var/lib/postgresql/data:rw','-e','POSTGRES_HOST_AUTH_METHOD=trust','-e','POSTGRES_USER='+USER,'-e','POSTGRES_DB='+DB,'postgres:17'])
 assert p.returncode==0,p.stderr
 container=p.stdout.strip()
 def sql(query,ok=True,db=DB):
  p=cmd(['docker','exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U',USER,'-d',db],input=query)
  if ok: assert p.returncode==0,p.stderr
  return p.stdout.strip() if ok else p
 for _ in range(100):
  if sql('SELECT 1',False).returncode==0:break
  time.sleep(.1)
 else:raise AssertionError('LOCAL_DATABASE_NOT_READY')
 def check(condition,label):
  global checks
  assert condition,label
  checks+=1
  print('PASS',label,flush=True)
 check(sql('SELECT current_database(),current_user')==DB+'|'+USER,'isolated database identity')
 check(cmd(['docker','inspect','--format','{{.HostConfig.NetworkMode}}',container]).stdout.strip()=='none','no network or exposed endpoint')
 candidate=(ROOT/'docs/proposals/liquidity-fencing-disposable.sql').read_text()
 check(sql(candidate,False,db='postgres').returncode!=0,'candidate rejects wrong database')
 sql('CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE liquidity_denied NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS; CREATE ROLE authenticator NOLOGIN NOINHERIT; CREATE ROLE supabase_realtime_admin NOLOGIN NOINHERIT; GRANT service_role TO authenticator, supabase_realtime_admin WITH INHERIT FALSE, SET TRUE;')
 for f in ['liquidity_evidence.sql','liquidity_evidence_snapshots.sql']:sql((ROOT/'supabase'/f).read_text())
 sql("INSERT INTO public.liquidity_evidence_checkpoints(mint,status,observed_at,evidence) VALUES(repeat('1',32),'partial',clock_timestamp(),'{\"synthetic\":true}'); INSERT INTO public.liquidity_evidence_snapshots(mint,observed_at,status,evidence) VALUES(repeat('1',32),clock_timestamp(),'partial','{\"synthetic\":true}');")
 baseline=sql('SELECT row_to_json(t) FROM public.liquidity_evidence_checkpoints t; SELECT row_to_json(t) FROM public.liquidity_evidence_snapshots t;')
 sql('GRANT ALL ON public.liquidity_evidence_checkpoints,public.liquidity_evidence_snapshots TO service_role; GRANT SELECT,USAGE,UPDATE ON public.liquidity_evidence_snapshots_id_seq TO anon,authenticated,service_role; ALTER DEFAULT PRIVILEGES FOR ROLE liquidity_local_owner GRANT ALL ON TABLES TO anon,authenticated,service_role; ALTER DEFAULT PRIVILEGES FOR ROLE liquidity_local_owner GRANT ALL ON SEQUENCES TO anon,authenticated,service_role; ALTER DEFAULT PRIVILEGES FOR ROLE liquidity_local_owner GRANT EXECUTE ON FUNCTIONS TO anon,authenticated,service_role;')
 defaults=sql("SELECT defaclobjtype,defaclnamespace,defaclacl::text FROM pg_default_acl WHERE defaclrole='liquidity_local_owner'::regrole ORDER BY 1,2")
 sql(candidate)
 check(sql('SELECT count(*) FROM liquidity_proposal.lane')=='0','setup creates no enrolled tip or authority')
 for role in ['anon','authenticated','liquidity_denied']:
  check(sql(f"SET ROLE {role}; SELECT * FROM liquidity_proposal.lane",False).returncode!=0,role+' cannot read private lane')
  check(sql(f"SET ROLE {role}; SELECT liquidity_proposal.claim(NULL,NULL)",False).returncode!=0,role+' cannot execute claim')
 check(sql("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='liquidity_proposal' AND c.relkind='r' AND c.relrowsecurity")=='7','all seven metadata tables have RLS')
 check(sql("SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='liquidity_proposal' AND p.prosecdef")=='0','no security-definer escalation')
 A='11111111-1111-4111-8111-111111111111';B='22222222-2222-4222-8222-222222222222'
 tip='a'*64;new='b'*64
 def reset():
  sql("TRUNCATE liquidity_proposal.admissions,liquidity_proposal.reviews,liquidity_proposal.artifacts,liquidity_proposal.reservations,liquidity_proposal.claims,liquidity_proposal.manifests,liquidity_proposal.lane; INSERT INTO liquidity_proposal.lane(singleton,tip,pool) VALUES(true,'"+tip+"',repeat('1',32));")
 def manifest(op=A,purpose='history',ceiling=2,start="clock_timestamp()-interval '1 second'",end="clock_timestamp()+interval '60 seconds'"):
  sql(f"INSERT INTO liquidity_proposal.manifests VALUES('{op}','doom404official-collab/DOOM404','refs/heads/fix/glitch-recovery-preflight-20261027',repeat('c',40),123,1,'{purpose}',repeat('1',32),'{tip}',repeat('d',64),{ceiling},{start},{end})")
 def claim(op=A):return sql(f"SELECT liquidity_proposal.claim('{op}','{tip}')")
 def stage(op=A,epoch=1,kind='history_candidate'):
  sql(f"SELECT liquidity_proposal.stage('{op}',{epoch},'12345','{new}','{kind}')")
 def review(op=A):
  sql(f"INSERT INTO liquidity_proposal.reviews VALUES('{op}','33333333-3333-4333-8333-333333333333','12345','{new}','{tip}',repeat('c',40),123,1,'success',true,true)")
 def admit(op=A,epoch=1):return f"SELECT liquidity_proposal.admit('{op}',{epoch},'{tip}')"
 reset();manifest();manifest(B)
 with concurrent.futures.ThreadPoolExecutor(2) as pool:
  results=list(pool.map(lambda op:sql(f"SELECT liquidity_proposal.claim('{op}','{tip}')",False),[A,B]))
 check(sum(r.returncode==0 for r in results)==1,'concurrent distinct writers yield one claim')
 reset();manifest();sql("UPDATE liquidity_proposal.manifests SET pool=repeat('2',32)");check(sql(f"SELECT liquidity_proposal.claim('{A}','{tip}')",False).returncode!=0,'wrong-pool manifest cannot reuse enrolled digest')
 reset();manifest();check(sql("SELECT liquidity_proposal.claim(NULL,NULL)",False).returncode!=0,'null claim cannot mutate lane')
 check(sql('SELECT epoch FROM liquidity_proposal.lane')=='0','invalid claim preserves epoch')
 reset();manifest();check(claim()=='1','claim returns canonical decimal epoch')
 check(sql(f"SELECT liquidity_proposal.claim('{A}','{tip}')",False).returncode!=0,'same-owner reclaim rejected')
 sql(f"SELECT liquidity_proposal.reserve('{A}',1,1)")
 check(sql(f"SELECT liquidity_proposal.reserve('{A}',1,1)",False).returncode!=0,'reservation replay rejected')
 sql(f"SELECT liquidity_proposal.reserve('{A}',1,2)")
 check(sql(f"SELECT liquidity_proposal.reserve('{A}',1,3)",False).returncode!=0,'shared reservation ceiling enforced')
 check(sql(f"SELECT liquidity_proposal.reserve('{A}',0,3)",False).returncode!=0,'stale epoch rejected')
 for start,end in [("clock_timestamp()+interval '10 seconds'","clock_timestamp()+interval '60 seconds'"),("clock_timestamp()-interval '60 seconds'","clock_timestamp()-interval '1 second'")]:
  reset();manifest(start=start,end=end);check(sql(f"SELECT liquidity_proposal.claim('{A}','{tip}')",False).returncode!=0,'closed manifest window rejected')
 reset();manifest();claim();sql("UPDATE liquidity_proposal.lane SET lease_until=clock_timestamp()-interval '1 second'")
 check(sql(f"SELECT liquidity_proposal.reserve('{A}',1,1)",False).returncode!=0,'expired lease cannot reserve')
 manifest(B);check(claim(B)=='2','new approved operation advances fencing epoch')
 check(sql(f"SELECT liquidity_proposal.stage('{A}',1,'12345','{new}','history_candidate')",False).returncode!=0,'expired owner cannot stage after takeover')
 reset();manifest();claim();sql("UPDATE liquidity_proposal.lane SET lease_until=clock_timestamp()+interval '50 milliseconds'")
 check(sql(f"BEGIN; SELECT pg_sleep(0.06); SELECT liquidity_proposal.reserve('{A}',1,1); COMMIT;",False).returncode!=0,'expiry uses wall clock after transaction start')
 reset();manifest();claim()
 with concurrent.futures.ThreadPoolExecutor(2) as pool:
  results=list(pool.map(lambda _:sql(f"SELECT liquidity_proposal.reserve('{A}',1,1)",False),range(2)))
 check(sum(r.returncode==0 for r in results)==1 and sql('SELECT count(*) FROM liquidity_proposal.reservations')=='1','concurrent reservation ordinal is consumed once')
 stage();check(sql(f"SELECT liquidity_proposal.stage('{A}',1,'54321','{tip}','history_candidate')",False).returncode!=0,'staged artifact identity cannot be replaced')
 check(sql('SELECT digest FROM liquidity_proposal.artifacts')==new,'rejected replacement preserves staged digest')
 reset();manifest();sql('UPDATE liquidity_proposal.lane SET epoch=9007199254740992');check(claim()=='9007199254740993','epoch beyond JS safe integer stays exact decimal')
 for patch in ["run_conclusion='failed'","run_conclusion='unknown'","lineage_verified=false","publication_reconciled=false","digest=repeat('e',64)","parent_digest=repeat('e',64)","commit_sha=repeat('e',40)","run_id=124","run_attempt=2","artifact_id='other'"]:
  reset();manifest();claim();stage();review();sql('UPDATE liquidity_proposal.reviews SET '+patch)
  check(sql(admit(),False).returncode!=0,'quarantine on '+patch)
  check(sql('SELECT tip FROM liquidity_proposal.lane')==tip,'quarantine preserves canonical tip')
 reset();manifest(purpose='replay');claim();stage(kind='replay_diagnostic');review();check(sql(admit(),False).returncode!=0,'replay cannot become canonical history')
 reset();manifest();claim();stage();review()
 sql("CREATE FUNCTION liquidity_proposal.test_fail_tip() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tip<>OLD.tip THEN RAISE EXCEPTION 'TEST_TRANSACTION_FAILURE'; END IF; RETURN NEW; END $$; CREATE TRIGGER test_fail_tip BEFORE UPDATE ON liquidity_proposal.lane FOR EACH ROW EXECUTE FUNCTION liquidity_proposal.test_fail_tip();")
 check(sql(admit(),False).returncode!=0,'failure after receipt insertion rolls back transaction')
 check(sql('SELECT count(*) FROM liquidity_proposal.admissions')=='0' and sql('SELECT tip FROM liquidity_proposal.lane')==tip,'receipt and tip rollback together')
 sql('DROP TRIGGER test_fail_tip ON liquidity_proposal.lane; DROP FUNCTION liquidity_proposal.test_fail_tip();')
 with concurrent.futures.ThreadPoolExecutor(2) as pool:results=list(pool.map(lambda _:sql(admit(),False),range(2)))
 check(sum(r.returncode==0 for r in results)==1,'concurrent admissions commit once')
 check(sql('SELECT successor_digest FROM liquidity_proposal.admissions')==new and sql('SELECT tip FROM liquidity_proposal.lane')==new,'lost acknowledgement reconciles receipt and tip without mutation retry')
 check(sql(admit(),False).returncode!=0,'terminal admission cannot replay')
 check(sql(f"SELECT liquidity_proposal.stage('{A}',1,'54321','{tip}','history_candidate')",False).returncode!=0,'terminal artifact cannot overwrite')
 check(sql('SELECT row_to_json(t) FROM public.liquidity_evidence_checkpoints t; SELECT row_to_json(t) FROM public.liquidity_evidence_snapshots t;')==baseline,'repository legacy table fixtures untouched')
 # Extend the same isolated database with the separate closed authority candidate.
 exec((pathlib.Path(__file__).parent/'authority-checks.py').read_text(),globals())
 exec((pathlib.Path(__file__).parent/'closed-checks.py').read_text(),globals())
 print('LOCAL_LIQUIDITY_FENCING_CHECKS='+str(checks))
finally:
 if container:cmd(['docker','rm','-f',container])
