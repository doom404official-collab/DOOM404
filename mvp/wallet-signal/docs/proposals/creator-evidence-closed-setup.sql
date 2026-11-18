-- UNAPPLIED CLOSED-SETUP CANDIDATE. Parent-only execution after permission audit.
-- No run/window/UID/credential is invented. Not in any migration or active path.
-- All names must be absent; collisions/errors roll back the whole transaction.
BEGIN;
CREATE SCHEMA creator_relay_test_private;
REVOKE ALL ON SCHEMA creator_relay_test_private FROM PUBLIC;
CREATE TABLE creator_relay_test_private.relay_reservations (
 object_key text PRIMARY KEY CHECK(object_key='relay-tests/creator-auth-flow-v1.json'),
 record jsonb NOT NULL CHECK(jsonb_typeof(record)='object' AND record->>'payloadSha256' IS NOT DISTINCT FROM 'c902eeb22e2fc05e6378f0c578686d991c1cc70d72aeefa61dc7ae0ffe1343dd' AND record->>'byteLength' IS NOT DISTINCT FROM '75'),
 expires_at timestamptz NOT NULL,
 claimed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(expires_at>claimed_at AND expires_at<=claimed_at+interval '5 minutes')
);
CREATE TABLE creator_relay_test_private.relay_consumptions (
 object_key text PRIMARY KEY REFERENCES creator_relay_test_private.relay_reservations(object_key),
 token_hash text NOT NULL CHECK(token_hash ~ '^[a-f0-9]{64}$'), consumed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE creator_relay_test_private.relay_readbacks (
 object_key text PRIMARY KEY REFERENCES creator_relay_test_private.relay_consumptions(object_key),
 token_hash text NOT NULL CHECK(token_hash ~ '^[a-f0-9]{64}$'), claimed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE creator_relay_test_private.relay_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_relay_test_private.relay_consumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_relay_test_private.relay_readbacks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA creator_relay_test_private FROM PUBLIC;
CREATE FUNCTION creator_relay_test_private.relay_reserve(p jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,creator_relay_test_private AS $$
DECLARE affected integer; expiry timestamptz;
BEGIN
 IF p IS NULL OR jsonb_typeof(p)<>'object' OR
  coalesce(p->>'capabilityHash','')!~'^[a-f0-9]{64}$' OR coalesce(p->>'payloadSha256','')!~'^[a-f0-9]{64}$' OR coalesce(p->>'issuedTokenHash','')!~'^[a-f0-9]{64}$' OR
  coalesce(p->>'commit','')!~'^[a-f0-9]{40}$' OR coalesce(p->>'runId','')!~'^[1-9][0-9]*$' OR p->>'runAttempt' IS DISTINCT FROM '1' OR
  coalesce(p->>'byteLength','')!~'^[1-9][0-9]*$' OR (p->>'byteLength')::bigint>1048576 OR coalesce(p->>'expiresAt','')!~'^[1-9][0-9]*$' THEN RAISE EXCEPTION 'INVALID_RELAY_RECORD'; END IF;
 expiry:=to_timestamp((p->>'expiresAt')::bigint);
 IF expiry<=clock_timestamp() OR expiry>clock_timestamp()+interval '5 minutes' THEN RAISE EXCEPTION 'RELAY_EXPIRED'; END IF;
 INSERT INTO relay_reservations(object_key,record,expires_at) VALUES(p->>'objectKey',p,expiry) ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF expiry<=clock_timestamp() THEN RAISE EXCEPTION 'RELAY_EXPIRED'; END IF;
 RETURN affected=1;
END $$;
CREATE FUNCTION creator_relay_test_private.relay_consume(p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,creator_relay_test_private AS $$
DECLARE r relay_reservations%ROWTYPE; affected integer;
BEGIN
 SELECT * INTO r FROM relay_reservations WHERE object_key=p->>'objectKey' AND expires_at>clock_timestamp()
 AND record->>'capabilityHash'=p->>'capabilityHash' AND record->>'payloadSha256'=p->>'payloadSha256' AND record->>'byteLength'=p->>'byteLength'
 AND record->>'runId'=p->>'runId' AND record->>'runAttempt'=p->>'runAttempt' AND record->>'commit'=p->>'commit';
 IF NOT FOUND THEN RETURN NULL; END IF;
 INSERT INTO relay_consumptions(object_key,token_hash) VALUES(r.object_key,p->>'tokenHash') ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF r.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'RELAY_EXPIRED'; END IF;
 IF affected<>1 THEN RETURN NULL; END IF;
 RETURN r.record;
END $$;
CREATE FUNCTION creator_relay_test_private.relay_readback(p jsonb,p_deadline bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,creator_relay_test_private AS $$
DECLARE r jsonb; affected integer;
BEGIN
 IF p_deadline IS NULL OR to_timestamp(p_deadline)<=clock_timestamp() OR to_timestamp(p_deadline)>clock_timestamp()+interval '5 minutes' THEN RAISE EXCEPTION 'READBACK_EXPIRED'; END IF;
 SELECT record INTO r FROM relay_reservations WHERE object_key=p->>'objectKey' AND record->>'runId'=p->>'runId' AND record->>'runAttempt'=p->>'runAttempt' AND record->>'commit'=p->>'commit'
 AND EXISTS(SELECT 1 FROM relay_consumptions WHERE object_key=p->>'objectKey');
 IF NOT FOUND THEN RETURN NULL; END IF;
 INSERT INTO relay_readbacks(object_key,token_hash) VALUES(p->>'objectKey',p->>'tokenHash') ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF to_timestamp(p_deadline)<=clock_timestamp() THEN RAISE EXCEPTION 'READBACK_EXPIRED'; END IF;
 IF affected<>1 THEN RETURN NULL; END IF;
 RETURN r;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA creator_relay_test_private FROM PUBLIC;

CREATE ROLE creator_test_issuer NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE creator_test_issuer_login LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 0 PASSWORD NULL;
GRANT creator_test_issuer TO creator_test_issuer_login WITH ADMIN FALSE, INHERIT TRUE, SET FALSE;
CREATE ROLE creator_test_consumer NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE creator_test_consumer_login LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 0 PASSWORD NULL;
GRANT creator_test_consumer TO creator_test_consumer_login WITH ADMIN FALSE, INHERIT TRUE, SET FALSE;
CREATE ROLE creator_test_verifier NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE creator_test_verifier_login LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 0 PASSWORD NULL;
GRANT creator_test_verifier TO creator_test_verifier_login WITH ADMIN FALSE, INHERIT TRUE, SET FALSE;
GRANT USAGE ON SCHEMA creator_relay_test_private TO creator_test_issuer,creator_test_consumer,creator_test_verifier;
GRANT EXECUTE ON FUNCTION creator_relay_test_private.relay_reserve(jsonb) TO creator_test_issuer;
GRANT EXECUTE ON FUNCTION creator_relay_test_private.relay_consume(jsonb) TO creator_test_consumer;
GRANT EXECUTE ON FUNCTION creator_relay_test_private.relay_readback(jsonb,bigint) TO creator_test_verifier;
GRANT INSERT ON creator_relay_test_private.relay_reservations TO creator_test_issuer;
GRANT SELECT ON creator_relay_test_private.relay_reservations TO creator_test_consumer,creator_test_verifier;
GRANT INSERT ON creator_relay_test_private.relay_consumptions TO creator_test_consumer;
GRANT SELECT ON creator_relay_test_private.relay_consumptions TO creator_test_verifier;
GRANT INSERT ON creator_relay_test_private.relay_readbacks TO creator_test_verifier;

CREATE POLICY closed_setup_guard ON creator_relay_test_private.relay_reservations AS RESTRICTIVE FOR ALL TO creator_test_issuer,creator_test_consumer,creator_test_verifier USING(false) WITH CHECK(false);
CREATE POLICY closed_setup_guard ON creator_relay_test_private.relay_consumptions AS RESTRICTIVE FOR ALL TO creator_test_issuer,creator_test_consumer,creator_test_verifier USING(false) WITH CHECK(false);
CREATE POLICY closed_setup_guard ON creator_relay_test_private.relay_readbacks AS RESTRICTIVE FOR ALL TO creator_test_issuer,creator_test_consumer,creator_test_verifier USING(false) WITH CHECK(false);
-- Fail rather than silently widening/removing existing permissions. Owner audit
-- must resolve reachable inherited PUBLIC grants outside this schema before setup
-- proceeds. Relation ACLs alone do not permit access without schema USAGE.
DO $$
DECLARE item text; login_oid oid; group_oid oid; r record;
BEGIN
 FOREACH item IN ARRAY ARRAY['issuer','consumer','verifier'] LOOP
  SELECT oid INTO STRICT login_oid FROM pg_roles WHERE rolname='creator_test_'||item||'_login';
  SELECT oid INTO STRICT group_oid FROM pg_roles WHERE rolname='creator_test_'||item;
  IF EXISTS(SELECT 1 FROM pg_authid WHERE oid IN(login_oid,group_oid) AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls OR rolpassword IS NOT NULL))
   OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE oid=login_oid AND rolcanlogin AND rolinherit AND rolconnlimit=0)
   OR EXISTS(SELECT 1 FROM pg_roles WHERE oid=group_oid AND rolcanlogin)
   OR (SELECT count(*) FROM pg_auth_members WHERE member=login_oid)<>1
   OR NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=login_oid AND roleid=group_oid AND NOT admin_option AND inherit_option AND NOT set_option)
   OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member=group_oid)
  THEN RAISE EXCEPTION 'CLOSED_ROLE_CONTRACT_FAILED'; END IF;
  IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE c.relkind IN('r','p','v','m','f') AND n.nspname NOT IN('pg_catalog','information_schema','creator_relay_test_private') AND n.nspname NOT LIKE 'pg_toast%'
   AND has_schema_privilege(login_oid,n.oid,'USAGE')
   AND has_table_privilege(login_oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
  THEN RAISE EXCEPTION 'OUTSIDE_TABLE_ACCESS_REQUIRES_PARENT_AUDIT'; END IF;
  IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE p.prosecdef AND n.nspname NOT IN('pg_catalog','information_schema','creator_relay_test_private') AND has_function_privilege(login_oid,p.oid,'EXECUTE')
   AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.refclassid='pg_extension'::regclass AND d.deptype='e'))
  THEN RAISE EXCEPTION 'OUTSIDE_FUNCTION_ACCESS_REQUIRES_PARENT_AUDIT'; END IF;
  FOR r IN SELECT c.oid,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='creator_relay_test_private' AND c.relkind='r' LOOP
   IF has_table_privilege(login_oid,r.oid,'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    OR has_table_privilege(login_oid,r.oid,'SELECT') IS DISTINCT FROM ((item='consumer' AND r.relname='relay_reservations') OR (item='verifier' AND r.relname IN('relay_reservations','relay_consumptions')))
    OR has_table_privilege(login_oid,r.oid,'INSERT') IS DISTINCT FROM (r.relname=CASE item WHEN 'issuer' THEN 'relay_reservations' WHEN 'consumer' THEN 'relay_consumptions' ELSE 'relay_readbacks' END)
   THEN RAISE EXCEPTION 'CLOSED_TABLE_PRIVILEGES_FAILED'; END IF;
  END LOOP;
  FOR r IN SELECT p.oid,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='creator_relay_test_private' LOOP
   IF has_function_privilege(login_oid,r.oid,'EXECUTE') IS DISTINCT FROM (r.proname=CASE item WHEN 'issuer' THEN 'relay_reserve' WHEN 'consumer' THEN 'relay_consume' ELSE 'relay_readback' END)
   THEN RAISE EXCEPTION 'CLOSED_FUNCTION_PRIVILEGES_FAILED'; END IF;
  END LOOP;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='creator_relay_test_private' AND c.relkind='r' AND (NOT c.relrowsecurity OR NOT EXISTS(SELECT 1 FROM pg_policy p WHERE p.polrelid=c.oid AND p.polname='closed_setup_guard' AND NOT p.polpermissive)))
 THEN RAISE EXCEPTION 'CLOSED_RLS_REQUIRED'; END IF;
END $$;
COMMIT;
-- No Storage/Auth changes, credentials, connection admission, windows or runtime.
