-- UNAPPLIED alternative to runtime-delivery.sql, NOT an automatic migration.
-- Requires reviewed closed setup + sealed transition. Never installs a window,
-- credential, runtime login, Storage policy or historical admission.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='8s';
SELECT pg_advisory_xact_lock(404,608);
DO $$ DECLARE k text; cap oid; login oid; r record; BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres'
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='postgres' AND NOT rolsuper AND rolcreaterole AND rolbypassrls)
 OR NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='creator_relay_test_private' AND nspowner='postgres'::regrole)
 THEN RAISE EXCEPTION 'SESSION_OWNER_DRIFT'; END IF;
 FOREACH k IN ARRAY ARRAY['issuer','consumer','verifier'] LOOP
  SELECT oid INTO STRICT cap FROM pg_roles WHERE rolname='creator_test_'||k;
  SELECT oid INTO STRICT login FROM pg_roles WHERE rolname='creator_test_'||k||'_login';
  IF EXISTS(SELECT 1 FROM pg_roles WHERE oid IN(cap,login) AND (rolsuper OR rolcreaterole OR rolcreatedb OR rolbypassrls OR rolreplication))
   OR EXISTS(SELECT 1 FROM pg_roles WHERE oid=cap AND rolcanlogin)
   OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE oid=login AND rolcanlogin AND rolinherit AND (rolconnlimit=0 OR (rolconnlimit=1 AND rolvaliduntil=(SELECT to_timestamp((binding->(CASE WHEN k='verifier' THEN 'readback' ELSE 'upload' END)->>'expiresAt')::bigint) FROM creator_relay_test_private.sealed_test_window WHERE singleton AND closed_at IS NULL))))
   OR (SELECT count(*) FROM pg_auth_members WHERE member=login)<>1
   OR NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=login AND roleid=cap AND grantor='postgres'::regrole AND NOT admin_option AND inherit_option AND NOT set_option)
   OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member=cap)
   OR EXISTS(SELECT 1 FROM pg_auth_members WHERE roleid IN(cap,login) AND NOT
    (member=login AND roleid=cap AND grantor='postgres'::regrole AND NOT admin_option AND inherit_option AND NOT set_option) AND NOT
    (member='postgres'::regrole AND grantor='postgres'::regrole AND admin_option AND NOT inherit_option AND NOT set_option))
  THEN RAISE EXCEPTION 'SESSION_MEMBERSHIP_DRIFT'; END IF;
  IF has_table_privilege(login,'creator_relay_test_private.sealed_test_window','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
   OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='creator_relay_test_private' AND c.relkind IN('r','p') AND has_table_privilege(login,c.oid,'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
  THEN RAISE EXCEPTION 'SESSION_EXISTING_DML_DRIFT'; END IF;
  IF EXISTS(SELECT 1 FROM pg_proc f JOIN pg_namespace n ON n.oid=f.pronamespace WHERE f.prosecdef
   AND n.nspname NOT IN('pg_catalog','information_schema','creator_relay_test_private')
   AND has_schema_privilege(login,n.oid,'USAGE') AND has_function_privilege(login,f.oid,'EXECUTE')
   AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=f.oid AND d.refclassid='pg_extension'::regclass AND d.deptype='e'))
  THEN RAISE EXCEPTION 'SESSION_OUTSIDE_FUNCTION_DRIFT'; END IF;
  IF has_schema_privilege(login,'creator_relay_test_private','CREATE') THEN RAISE EXCEPTION 'SESSION_SCHEMA_PRIVILEGE_DRIFT'; END IF;
  IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN('r','p','v','m','f')
    AND n.nspname NOT IN('pg_catalog','information_schema','creator_relay_test_private') AND n.nspname NOT LIKE 'pg_toast%'
    AND has_schema_privilege(login,n.oid,'USAGE') AND has_table_privilege(login,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
   THEN RAISE EXCEPTION 'SESSION_OUTSIDE_ACCESS_DRIFT'; END IF;
 END LOOP;
 -- Only the known broad defaults are tolerated and explicitly revoked below.
 IF EXISTS(SELECT 1 FROM pg_default_acl a CROSS JOIN LATERAL aclexplode(a.defaclacl) e
  WHERE a.defaclrole='postgres'::regrole AND a.defaclnamespace IN(0,'creator_relay_test_private'::regnamespace)
  AND a.defaclobjtype IN('r','f') AND e.grantee NOT IN(0,'postgres'::regrole,'anon'::regrole,'authenticated'::regrole,'service_role'::regrole))
 THEN RAISE EXCEPTION 'SESSION_DEFAULT_ACL_DRIFT'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('creator_relay_test_private.sealed_test_window') AND relowner='postgres'::regrole AND relrowsecurity)
 THEN RAISE EXCEPTION 'SESSION_SEAL_OWNER_DRIFT'; END IF;

 IF to_regclass('creator_relay_test_private.sealed_test_window') IS NULL
 OR to_regclass('creator_relay_test_private.runtime_delivery') IS NOT NULL
 OR to_regclass('creator_relay_test_private.auth_attempts') IS NOT NULL THEN
 RAISE EXCEPTION 'SESSION_SETUP_PRECONDITION'; END IF;
END $$;
CREATE TABLE creator_relay_test_private.auth_attempts(
 phase text PRIMARY KEY CHECK(phase IN('upload','readback')),
 binding jsonb NOT NULL, reserved_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 outcome text NOT NULL DEFAULT 'UNKNOWN' CHECK(outcome='UNKNOWN')
);
ALTER TABLE creator_relay_test_private.auth_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON creator_relay_test_private.auth_attempts FROM PUBLIC,anon,authenticated,service_role,
 creator_test_issuer,creator_test_consumer,creator_test_verifier,
 creator_test_issuer_login,creator_test_consumer_login,creator_test_verifier_login;
CREATE FUNCTION creator_relay_test_private.relay_auth_attempt(r jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,creator_relay_test_private AS $$
DECLARE b jsonb; p text; d jsonb; n integer; BEGIN
 IF r IS NULL OR jsonb_typeof(r)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(r))<>3 THEN RETURN false; END IF;
 p:=r->>'phase';d:=r->'deployment';
 IF p IS NULL OR p NOT IN('upload','readback') OR session_user IS DISTINCT FROM
 (CASE WHEN p='upload' THEN 'creator_test_consumer_login' ELSE 'creator_test_verifier_login' END) THEN RETURN false; END IF;
 -- Share lock orders reservation against explicit closeout. A committed claim is
 -- never deleted/released, even when subsequent HTTP delivery is unknown.
 SELECT binding INTO b FROM creator_relay_test_private.sealed_test_window WHERE singleton AND closed_at IS NULL FOR SHARE;
 IF b IS NULL OR r->'binding' IS DISTINCT FROM b OR jsonb_typeof(d) IS DISTINCT FROM 'object'
 OR (SELECT count(*) FROM jsonb_object_keys(d))<>6
 OR d->>'target' IS DISTINCT FROM 'preview' OR d->>'projectId' IS DISTINCT FROM b->>'vercelProjectId'
 OR d->>'id' IS DISTINCT FROM b->>'deploymentId' OR d->>'url' IS DISTINCT FROM b->>'deploymentUrl'
 OR d->>'commit' IS DISTINCT FROM b->>'commit' OR d->>'branch' IS DISTINCT FROM 'fix/glitch-recovery-preflight-20261027'
 OR b->>'uploadUid' IS DISTINCT FROM '4b4d628a-d0cc-438e-bf04-661d1a5ea546'
 OR b->>'readUid' IS DISTINCT FROM '3393dbd5-209f-4e3b-934d-57006fcdc4fa'
 OR clock_timestamp()<to_timestamp((b->p->>'startsAt')::bigint)
 OR clock_timestamp()>=to_timestamp((b->p->>'expiresAt')::bigint) THEN RETURN false; END IF;
 INSERT INTO creator_relay_test_private.auth_attempts(phase,binding) VALUES(p,b) ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS n=ROW_COUNT;
 RETURN n=1;
END $$;
REVOKE ALL ON FUNCTION creator_relay_test_private.relay_auth_attempt(jsonb) FROM PUBLIC,anon,authenticated,service_role,creator_test_issuer,creator_test_issuer_login;
GRANT EXECUTE ON FUNCTION creator_relay_test_private.relay_auth_attempt(jsonb) TO creator_test_consumer,creator_test_verifier;
CREATE FUNCTION creator_relay_test_private.relay_session_binding(identity jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,creator_relay_test_private AS $$
DECLARE b jsonb; a text; p text; BEGIN
 IF identity IS NULL OR jsonb_typeof(identity)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(identity))<>7 THEN RETURN NULL; END IF;
 a:=identity->>'action';p:=CASE WHEN a='verify' THEN 'readback' ELSE 'upload' END;
 IF a IS NULL OR a NOT IN('issue','upload','verify') OR session_user IS DISTINCT FROM
 (CASE WHEN a='verify' THEN 'creator_test_verifier_login' ELSE 'creator_test_issuer_login' END) THEN RETURN NULL; END IF;
 SELECT binding INTO b FROM creator_relay_test_private.sealed_test_window WHERE singleton AND closed_at IS NULL;
 IF b IS NULL OR identity->>'target' IS DISTINCT FROM 'preview' OR identity->>'projectId' IS DISTINCT FROM b->>'vercelProjectId'
 OR identity->>'id' IS DISTINCT FROM b->>'deploymentId' OR identity->>'url' IS DISTINCT FROM b->>'deploymentUrl'
 OR identity->>'commit' IS DISTINCT FROM b->>'commit' OR identity->>'branch' IS DISTINCT FROM 'fix/glitch-recovery-preflight-20261027'
 OR clock_timestamp()<to_timestamp((b->p->>'startsAt')::bigint) OR clock_timestamp()>=to_timestamp((b->p->>'expiresAt')::bigint) THEN RETURN NULL; END IF;
 RETURN b;
END $$;
REVOKE ALL ON FUNCTION creator_relay_test_private.relay_session_binding(jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION creator_relay_test_private.relay_session_binding(jsonb) TO creator_test_issuer,creator_test_verifier;
DO $$ DECLARE r text; BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role','creator_test_issuer_login','creator_test_consumer_login','creator_test_verifier_login'] LOOP
  IF has_table_privilege(r,'creator_relay_test_private.auth_attempts','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
   OR has_function_privilege(r,'creator_relay_test_private.relay_auth_attempt(jsonb)','EXECUTE') IS DISTINCT FROM (r IN('creator_test_consumer_login','creator_test_verifier_login'))
   OR has_function_privilege(r,'creator_relay_test_private.relay_session_binding(jsonb)','EXECUTE') IS DISTINCT FROM (r IN('creator_test_issuer_login','creator_test_verifier_login'))
  THEN RAISE EXCEPTION 'SESSION_EFFECTIVE_PRIVILEGE_DRIFT'; END IF;
 END LOOP;
END $$;
COMMIT;
-- Trusted administrator retains control. Runtime principals have no direct DML.
-- Separate future production schema/object admission requires a reviewed proposal;
-- this exact candidate is fixed to the existing one-object synthetic seal.
