# Executed by run-local.py only, inside its owned network-isolated container.
check(sql("SELECT has_sequence_privilege('anon','public.liquidity_evidence_snapshots_id_seq','SELECT,USAGE,UPDATE')")=='t','fixture reproduces excess legacy sequence privileges')
check(sql("SELECT has_table_privilege('service_role','liquidity_proposal.lane','UPDATE')")=='t','fixture reproduces broad object-creator default ACL')
authority=(ROOT/'docs/proposals/liquidity-authority-disposable.sql').read_text()
check(sql(authority,False,db='postgres').returncode!=0,'authority candidate retains disposable database guard')
sql(authority)
check(sql("SELECT defaclobjtype,defaclnamespace,defaclacl::text FROM pg_default_acl WHERE defaclrole='liquidity_local_owner'::regrole ORDER BY 1,2")==defaults,'shared creator defaults left unchanged')
for role in ['anon','authenticated','service_role']:
 check(sql(f"SELECT has_table_privilege('{role}','liquidity_proposal.lane','UPDATE')")=='f',role+' inherited default table grant removed')
 check(sql(f"SELECT has_function_privilege('{role}','liquidity_proposal.claim(uuid,text)','EXECUTE')")=='f',role+' inherited default execute grant removed')
for role in ['anon','authenticated']:
 for privilege in ['SELECT','USAGE','UPDATE']:
  check(sql(f"SELECT has_sequence_privilege('{role}','public.liquidity_evidence_snapshots_id_seq','{privilege}')")=='f',role+' sequence '+privilege+' revoked locally')
check(sql("SELECT has_sequence_privilege('service_role','public.liquidity_evidence_snapshots_id_seq','SELECT,USAGE,UPDATE')")=='t','service sequence rights preserved')
check(sql("SELECT has_table_privilege('service_role','public.liquidity_evidence_checkpoints','INSERT,UPDATE,SELECT')")=='t','legacy service table privileges unchanged')
check(sql("SET ROLE authenticator; SET ROLE service_role; SELECT * FROM liquidity_proposal.lane",False).returncode!=0,'SET service_role cannot recover removed private privileges')
check(sql("SELECT count(*) FROM pg_auth_members WHERE roleid IN ('lq_test_code_owner'::regrole,'lq_test_executor'::regrole,'lq_test_reviewer'::regrole)")=='0','no runtime role memberships')
check(sql("SELECT bool_and(NOT rolcanlogin AND NOT rolbypassrls AND NOT rolsuper) FROM pg_roles WHERE rolname IN ('lq_test_code_owner','lq_test_executor','lq_test_reviewer')")=='t','candidate roles closed and non-bypass by default')
# Actual local database sessions, not caller-supplied authenticated flags or
# superuser SET SESSION AUTHORIZATION. Trust is local to this disposable container.
sql('ALTER ROLE lq_test_executor LOGIN; ALTER ROLE lq_test_reviewer LOGIN; CREATE ROLE lq_test_unbound LOGIN NOINHERIT; GRANT USAGE ON SCHEMA liquidity_proposal TO lq_test_unbound; GRANT EXECUTE ON FUNCTION liquidity_proposal.claim(uuid,text) TO lq_test_unbound;')
def session(role,query,ok=True):
 p=cmd(['docker','exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U',role,'-d',DB],input=query)
 if ok:assert p.returncode==0,p.stderr
 return p.stdout.strip() if ok else p
for role in ['lq_test_executor','lq_test_reviewer']:
 check(session(role,'SELECT session_user,current_user')==role+'|'+role,'real local login identity '+role)
 for query in ["UPDATE liquidity_proposal.lane SET epoch=999","INSERT INTO liquidity_proposal.admissions SELECT * FROM liquidity_proposal.admissions","DELETE FROM liquidity_proposal.artifacts","SELECT * FROM liquidity_proposal.manifests","SET ROLE lq_test_code_owner","CREATE FUNCTION liquidity_proposal.shadow() RETURNS int LANGUAGE sql AS 'SELECT 1'","UPDATE public.liquidity_evidence_checkpoints SET status='partial'"]:
  check(session(role,query,False).returncode!=0,role+' direct bypass denied: '+query.split()[0])
 for name,args in [('claim_internal',f"'{A}','{tip}'"),('assert_live',f"'{A}',1")]:
  check(session(role,f'SELECT liquidity_proposal.{name}({args})',False).returncode!=0,role+' internal function denied '+name)
sql('TRUNCATE liquidity_proposal.authorities,liquidity_proposal.admissions,liquidity_proposal.reviews,liquidity_proposal.artifacts,liquidity_proposal.reservations,liquidity_proposal.claims,liquidity_proposal.manifests,liquidity_proposal.lane;')
sql(f"INSERT INTO liquidity_proposal.lane(singleton,tip,pool) VALUES(true,'{tip}',repeat('1',32))")
manifest();manifest(B)
sql(f"INSERT INTO liquidity_proposal.authorities VALUES('{A}','lq_test_executor','lq_test_reviewer')")
check(session('lq_test_unbound',f"SELECT liquidity_proposal.claim('{A}','{tip}')",False).returncode!=0,'unbound login denied despite execute privilege')
check(session('lq_test_executor',f"SELECT set_config('request.jwt.claim.role','reviewer',false); SELECT liquidity_proposal.claim('{B}','{tip}')",False).returncode!=0,'caller settings cannot forge operation binding')
check(session('lq_test_executor',f"SELECT liquidity_proposal.claim('{A}','{tip}')")=='1','bound executor can claim through narrow definer')
check(session('lq_test_executor',f"SELECT liquidity_proposal.reserve('{A}',1,1)")=='1','bound executor reserves without table grants')
session('lq_test_executor',f"SELECT liquidity_proposal.stage('{A}',1,'12345','{new}','history_candidate')")
review_sql=f"SELECT liquidity_proposal.record_review('{A}','33333333-3333-4333-8333-333333333333','12345','{new}','{tip}',repeat('c',40),123,1,'success',true,true)"
check(session('lq_test_executor',review_sql,False).returncode!=0,'executor cannot attest its own review')
check(session('lq_test_reviewer',f"SELECT liquidity_proposal.reserve('{A}',1,2)",False).returncode!=0,'reviewer cannot spend worker budget')
check(session('lq_test_executor',admit(),False).returncode!=0,'executor cannot admit')
check(session('lq_test_reviewer',admit(),False).returncode!=0,'reviewer cannot admit missing attestation')
session('lq_test_reviewer',review_sql)
check(session('lq_test_reviewer',review_sql,False).returncode!=0,'review attestation cannot overwrite')
check(session('lq_test_reviewer',admit())==new,'independent bound reviewer admits atomic receipt')
check('successor_digest' in session('lq_test_executor',f"SELECT liquidity_proposal.read_receipt('{A}')"),'bound executor can reconcile own outcome')
check(session('lq_test_executor',f"SELECT liquidity_proposal.read_receipt('{B}')",False).returncode!=0,'receipt read is operation scoped')
check(session('lq_test_executor','RESET SESSION AUTHORIZATION; SELECT session_user')=='lq_test_executor','login cannot reset into fixture administrator')
check(sql('SELECT row_to_json(t) FROM public.liquidity_evidence_checkpoints t; SELECT row_to_json(t) FROM public.liquidity_evidence_snapshots t;')==baseline,'authority tests preserve all legacy data fixtures')

check(sql("SET ROLE lq_test_code_owner; UPDATE liquidity_proposal.manifests SET operation=operation",False).returncode!=0,'lock-only privilege cannot actually update sealed manifests')
check(sql("SET ROLE lq_test_code_owner; UPDATE liquidity_proposal.artifacts SET operation=operation",False).returncode!=0,'lock-only privilege cannot actually update artifact identity')
check(sql("SET ROLE lq_test_code_owner; UPDATE liquidity_proposal.reviews SET operation=operation",False).returncode!=0,'lock-only privilege cannot actually update attestation')
sequence_before=sql('SELECT last_value,is_called FROM public.liquidity_evidence_snapshots_id_seq')
for role in ['anon','authenticated']:
 check(sql(f"SET ROLE {role}; SELECT nextval('public.liquidity_evidence_snapshots_id_seq')",False).returncode!=0,role+' cannot mutate local sequence after hardening')
check(sql('SELECT last_value,is_called FROM public.liquidity_evidence_snapshots_id_seq')==sequence_before,'denied local sequence probes do not advance identity')
tip_before=sql('SELECT tip FROM liquidity_proposal.lane')
sql("SET ROLE pg_write_all_data; UPDATE liquidity_proposal.lane SET tip=repeat('e',64)",False)
check(sql('SELECT tip FROM liquidity_proposal.lane')==tip_before,'nominal pg_write_all_data privilege does not bypass private RLS')
check(session('lq_test_executor',f"SET search_path=pg_temp,public; CREATE TEMP TABLE authorities(operation uuid,executor_role name); INSERT INTO authorities VALUES('{B}','lq_test_executor'); SELECT liquidity_proposal.read_receipt('{B}')",False).returncode!=0,'temporary search-path shadow cannot forge authority')
check(session('lq_test_reviewer','SET ROLE lq_test_executor',False).returncode!=0,'reviewer cannot impersonate executor role')
