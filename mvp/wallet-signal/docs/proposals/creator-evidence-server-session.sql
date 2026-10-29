-- UNAPPLIED alternative to runtime-delivery.sql, NOT an automatic migration.
-- Requires reviewed closed setup + sealed transition. Never installs a window,
-- credential, runtime login, Storage policy or historical admission.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='8s';
SELECT pg_advisory_xact_lock(404,608);
DO $$ BEGIN
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
COMMIT;
-- Trusted administrator retains control. Runtime principals have no direct DML.
-- Separate future production schema/object admission requires a reviewed proposal;
-- this exact candidate is fixed to the existing one-object synthetic seal.
