"""Synthetic Actions service ONLY. Never accepts a connection target or credentials."""
from pathlib import Path
import subprocess,json,os,shutil,hashlib
root=Path(__file__).resolve().parents[3]
here=Path(__file__).resolve().parent
db='glitch_creator_evidence_test'
HOST='127.0.0.1';PORT='5432'
PSQL='/usr/bin/psql'
# Completely replace inherited environment: PGHOST/PGSERVICE/PGOPTIONS,
# password files, user rc files and Node options cannot redirect this harness.
ENV={'PATH':'/usr/bin:/bin','HOME':'/nonexistent','LC_ALL':'C',
 'PGPASSWORD':'ci-only','PGPASSFILE':'/dev/null','PGSERVICEFILE':'/dev/null',
 'PGCONNECT_TIMEOUT':'3','PGSSLMODE':'disable',
 'PGOPTIONS':'-c statement_timeout=8000 -c lock_timeout=2000'}
GUARD="DO $$ BEGIN IF current_database()<>'glitch_creator_evidence_test' OR inet_server_port() IS DISTINCT FROM 5432 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999 THEN RAISE EXCEPTION 'SYNTHETIC_DATABASE_REQUIRED'; END IF; END $$;"
def sql(q,who='postgres',ok=True):
 if HOST!='127.0.0.1' or PORT!='5432' or db!='glitch_creator_evidence_test' or who not in ('postgres','creator_test'):
  raise RuntimeError('SYNTHETIC_TARGET_REQUIRED')
 r=subprocess.run([PSQL,'-X','-w','-qAt','-v','ON_ERROR_STOP=1','-h',HOST,'-p',PORT,'-U',who,'-d',db],input=GUARD+'\n'+q,text=True,capture_output=True,env=ENV.copy(),timeout=15)
 if ok: assert r.returncode==0,'SYNTHETIC_SQL_FAILED'
 return r
checks=0
def check(label,v):
 global checks
 assert v,label;checks+=1;print('PASS '+label,flush=True)
def closed():
 return sql("SELECT to_regclass('creator_relay_test_private.sealed_test_window') IS NULL AND to_regclass('creator_relay_test_private.auth_attempts') IS NULL AND (SELECT bool_and(rolconnlimit=0) FROM pg_roles WHERE rolname LIKE 'creator_test_%_login') AND (SELECT count(*)=1 FROM pg_policy WHERE polrelid='storage.objects'::regclass) AND (SELECT bool_and(pg_get_expr(polqual,polrelid)='false') FROM pg_policy WHERE polname='closed_setup_guard')").stdout.strip()=='t'
def main():
 global checks
 checks=0
 if not Path(PSQL).is_file(): raise RuntimeError('PSQL_NOT_PREINSTALLED')
 node=shutil.which('node')
 if not node: raise RuntimeError('NODE_NOT_PREINSTALLED')
 candidate=here/'creator-evidence-atomic-transition.sql'
 if hashlib.sha256(candidate.read_bytes()).hexdigest()!='11685ace263ca566b9bb9964afac72ab33ffebaea8c40e1fe9c4c45b40b05ea1':
  raise RuntimeError('CANDIDATE_HASH_MISMATCH')
 # Read-only bootstrap identity/freshness check before any fixture mutation.
 fresh=sql("SELECT current_user='creator_test' AND session_user='creator_test' AND (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) AND NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='postgres') AND to_regnamespace('creator_relay_test_private') IS NULL AND to_regnamespace('auth') IS NULL AND to_regnamespace('storage') IS NULL",'creator_test').stdout.strip()
 if fresh!='t': raise RuntimeError('FRESH_SYNTHETIC_SERVICE_REQUIRED')
 sql('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE ROLE postgres LOGIN PASSWORD \'ci-only\' NOSUPERUSER CREATEROLE CREATEDB BYPASSRLS INHERIT;ALTER DATABASE '+db+' OWNER TO postgres;GRANT SELECT ON pg_authid TO postgres;','creator_test')
 sql((root/'docs/proposals/creator-evidence-closed-setup.sql').read_text())
 # Same explicit synthetic bootstrap-grantor model used by retained session suite.
 sql("UPDATE pg_auth_members SET grantor='postgres'::regrole WHERE member='postgres'::regrole AND roleid::regrole::text LIKE 'creator_test_%'",'creator_test')
 u='4b4d628a-d0cc-438e-bf04-661d1a5ea546';v='3393dbd5-209f-4e3b-934d-57006fcdc4fa'
 sql("CREATE SCHEMA auth;CREATE SCHEMA storage;CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;CREATE TABLE storage.objects(bucket_id text,name text,PRIMARY KEY(bucket_id,name));ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;GRANT USAGE ON SCHEMA auth,storage TO authenticated;GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated;INSERT INTO auth.users VALUES('"+u+"'),('"+v+"');")
 sql((root/'docs/proposals/creator-evidence-closed-storage.sql.in').read_text().replace('{{UPLOAD_UID}}',u).replace('{{READ_UID}}',v))
 for role in ['issuer','consumer','verifier']:sql("ALTER ROLE creator_test_"+role+"_login PASSWORD 'DISPOSABLE_ONLY';")
 sql('ALTER DEFAULT PRIVILEGES GRANT ALL ON TABLES TO anon,authenticated,service_role;ALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO anon,authenticated,service_role;')
 b=json.loads(subprocess.run([node,'--input-type=module','-e',"import {binding} from './tests/fixtures/creator-evidence/owner-auth-fixture.mjs';import {validateCreatorSealedBinding} from './lib/creatorEvidenceSealedBinding.mjs';console.log(JSON.stringify(validateCreatorSealedBinding(binding(Math.floor(Date.now()/1000)))));"],cwd=root,capture_output=True,text=True,check=True,env={'PATH':'/usr/bin:/bin','HOME':'/nonexistent','LC_ALL':'C'},timeout=10).stdout)
 body=(here/'creator-evidence-atomic-transition.sql').read_text()
 prefix="BEGIN;CREATE TEMP TABLE creator_test_approved_bindings(binding jsonb NOT NULL) ON COMMIT DROP;INSERT INTO creator_test_approved_bindings VALUES ('"+json.dumps(b).replace("'","''")+"'::jsonb);"
 check('baseline closed',closed())
 check('absent binding rejects without change',sql('BEGIN;'+body,ok=False).returncode!=0 and closed())
 # Deliberate failure after all DDL/policy/role changes, before sole COMMIT.
 injected=body.replace('\nCOMMIT;',"\nDO $$ BEGIN RAISE EXCEPTION 'SYNTHETIC_LATE_FAILURE'; END $$;\nCOMMIT;")
 r=sql(prefix+injected,ok=False)
 check('late failure rolls back seal session policies and limits','SYNTHETIC_LATE_FAILURE' in r.stderr and closed())
 sql('CREATE ROLE unexpected_default;ALTER DEFAULT PRIVILEGES GRANT SELECT ON TABLES TO unexpected_default;')
 r=sql(prefix+body,ok=False)
 check('session ACL failure rolls back preceding transition','SESSION_DEFAULT_ACL_DRIFT' in r.stderr and closed())
 sql('ALTER DEFAULT PRIVILEGES REVOKE SELECT ON TABLES FROM unexpected_default;')
 sql(prefix+body)
 check('both components committed together',sql("SELECT to_regclass('creator_relay_test_private.auth_attempts') IS NOT NULL AND to_regprocedure('creator_relay_test_private.relay_session_binding(jsonb)') IS NOT NULL AND (SELECT count(*)=1 FROM creator_relay_test_private.sealed_test_window)").stdout.strip()=='t')
 check('seal broad defaults closed',sql("SELECT NOT has_table_privilege('anon','creator_relay_test_private.sealed_test_window','SELECT') AND NOT has_table_privilege('service_role','creator_relay_test_private.sealed_test_window','SELECT')").stdout.strip()=='t')
 check('replay rejects',sql(prefix+body,ok=False).returncode!=0)
 sql((root/'docs/proposals/creator-evidence-sealed-closeout.sql').read_text())
 check('closeout retains seal and disables logins',sql("SELECT (SELECT closed_at IS NOT NULL FROM creator_relay_test_private.sealed_test_window) AND (SELECT bool_and(NOT rolcanlogin AND rolconnlimit=0) FROM pg_roles WHERE rolname LIKE 'creator_test_%_login')").stdout.strip()=='t')
 print('ATOMIC_ROLLBACK_CHECKS='+str(checks))

if __name__=="__main__":
 main()
