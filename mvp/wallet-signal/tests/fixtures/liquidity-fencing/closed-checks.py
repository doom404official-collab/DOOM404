# Uses only run-local.py's owned network-disabled PostgreSQL container.
closed=(ROOT/'docs/proposals/liquidity-closed-setup-candidate.sql').read_text()
check(closed.count("RAISE EXCEPTION 'DISPOSABLE_LIQUIDITY_DATABASE_REQUIRED'")==2,'both original disposable guards retained')
check(sql(closed,False,db='postgres').returncode!=0,'closed setup rejects wrong database')
roles=['liquidity_fencing_code_owner','liquidity_fencing_executor','liquidity_fencing_reviewer']
schema='liquidity_fencing_private'
sql('GRANT SELECT,USAGE,UPDATE ON public.liquidity_evidence_snapshots_id_seq TO anon,authenticated')
legacy=sql("SELECT relname,relacl::text FROM pg_class WHERE oid IN ('public.liquidity_evidence_checkpoints'::regclass,'public.liquidity_evidence_snapshots'::regclass) ORDER BY relname")
for role in roles:
 sql(f'CREATE ROLE {role} NOLOGIN')
 check(sql(closed,False).returncode!=0,'preexisting role rejects setup: '+role)
 check(sql(f"SELECT count(*) FROM pg_namespace WHERE nspname='{schema}'")=='0','role conflict rolls back schema and objects')
 check(sql(f"SELECT count(*) FROM pg_roles WHERE rolname IN ({','.join(repr(r) for r in roles)})")=='1','role conflict preserves existing role only')
 sql(f'DROP ROLE {role}')
sql(f'CREATE SCHEMA {schema}; CREATE TABLE {schema}.sentinel(value integer); INSERT INTO {schema}.sentinel VALUES(7)')
check(sql(closed,False).returncode!=0,'preexisting schema rejects setup')
check(sql(f'SELECT value FROM {schema}.sentinel')=='7','conflicting schema untouched')
sql(f'DROP SCHEMA {schema} CASCADE')
injected=closed.rsplit('COMMIT;',1)[0]+"DO $$ BEGIN RAISE EXCEPTION 'INJECTED_CLOSED_FAILURE'; END $$; COMMIT;"
check(sql(injected,False).returncode!=0,'failure after grants and sequence revoke aborts transaction')
check(sql(f"SELECT count(*) FROM pg_namespace WHERE nspname='{schema}'")=='0','failed transaction leaves no private schema')
check(sql(f"SELECT count(*) FROM pg_roles WHERE rolname IN ({','.join(repr(r) for r in roles)})")=='0','failed transaction leaves no new roles')
check(sql("SELECT has_sequence_privilege('anon','public.liquidity_evidence_snapshots_id_seq','UPDATE')")=='t','failed transaction restores original sequence privileges')
sql(closed)
check(sql(f"SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='{schema}' AND c.relkind='r' AND c.relrowsecurity")=='8','exact eight RLS tables')
for table in ['lane','manifests','authorities','claims','reservations','artifacts','reviews','admissions']:
 check(sql(f'SELECT count(*) FROM {schema}.{table}')=='0','closed table empty: '+table)
for role in roles:
 check(sql(f"SELECT NOT rolcanlogin AND rolpassword IS NULL AND rolconnlimit=0 AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication AND NOT rolinherit FROM pg_authid WHERE rolname='{role}'")=='t','exact closed role attributes: '+role)
 check(sql(f"SELECT count(*) FROM pg_auth_members WHERE roleid='{role}'::regrole OR member='{role}'::regrole")=='0','no memberships either direction: '+role)
 check(sql(f"SELECT has_schema_privilege('{role}','{schema}','CREATE')")=='f','no code replacement privilege: '+role)
for role in ['anon','authenticated','service_role']:
 check(sql(f"SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='{schema}' AND c.relkind='r' AND (has_table_privilege('{role}',c.oid,'SELECT') OR has_table_privilege('{role}',c.oid,'INSERT') OR has_table_privilege('{role}',c.oid,'UPDATE') OR has_table_privilege('{role}',c.oid,'DELETE'))")=='0','all private table default grants closed: '+role)
 check(sql(f"SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='{schema}' AND has_function_privilege('{role}',p.oid,'EXECUTE')")=='0','all private function default grants closed: '+role)
for role,allowed in [(roles[1],['claim','reserve','stage','read_receipt']),(roles[2],['record_review','admit','read_receipt'])]:
 actual=sql(f"SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='{schema}' AND has_function_privilege('{role}',p.oid,'EXECUTE') ORDER BY proname").splitlines()
 check(actual==sorted(allowed),'exact runtime function allowlist: '+role)
 check(sql(f'SET ROLE {role}; SELECT {schema}.claim(NULL,NULL)',False).returncode!=0,'inert unbound operation denied: '+role)
 check(sql(f'SET ROLE {role}; INSERT INTO {schema}.authorities VALUES(NULL,NULL,NULL)',False).returncode!=0,'runtime cannot enroll authority: '+role)
check(sql(f"SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='{schema}' AND p.prosecdef AND (p.proowner<>'liquidity_fencing_code_owner'::regrole OR NOT ('search_path=pg_catalog, liquidity_fencing_private'=ANY(p.proconfig)))")=='0','definer owner and fixed search path exact')
check(sql("SELECT has_sequence_privilege('anon','public.liquidity_evidence_snapshots_id_seq','SELECT,USAGE,UPDATE') OR has_sequence_privilege('authenticated','public.liquidity_evidence_snapshots_id_seq','SELECT,USAGE,UPDATE')")=='f','narrow sequence revoke applied')
check(sql("SELECT has_sequence_privilege('service_role','public.liquidity_evidence_snapshots_id_seq','SELECT,USAGE,UPDATE')")=='t','service sequence rights retained')
check(sql("SELECT relname,relacl::text FROM pg_class WHERE oid IN ('public.liquidity_evidence_checkpoints'::regclass,'public.liquidity_evidence_snapshots'::regclass) ORDER BY relname")==legacy,'legacy table ACLs unchanged')
check(sql('SELECT row_to_json(t) FROM public.liquidity_evidence_checkpoints t; SELECT row_to_json(t) FROM public.liquidity_evidence_snapshots t;')==baseline,'legacy rows unchanged')
check(sql("SELECT defaclobjtype,defaclnamespace,defaclacl::text FROM pg_default_acl WHERE defaclrole='liquidity_local_owner'::regrole ORDER BY 1,2")==defaults,'shared object creator defaults unchanged')
check(sql(closed,False).returncode!=0,'post-commit replay rejects rather than silently modifying installed setup')
check(sql(f'SELECT count(*) FROM {schema}.lane')=='0','post-commit replay remains inert')
