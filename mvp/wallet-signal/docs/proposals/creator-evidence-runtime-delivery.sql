-- UNAPPLIED additional permission proposal. No secrets/placeholders/default window.
-- Apply only AFTER independently approved sealed transition, BEFORE its window.
-- Operator supplies ONE private pg_temp.creator_test_runtime_input(payload jsonb)
-- using a secure parameterized owner-operated session; never paste tokens in chat.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='8s';
SELECT pg_advisory_xact_lock(404,608);
DO $$ DECLARE b jsonb; p jsonb; BEGIN
 IF to_regclass('creator_relay_test_private.sealed_test_window') IS NULL OR to_regclass('pg_temp.creator_test_runtime_input') IS NULL THEN RAISE EXCEPTION 'MISSING_APPROVED_DELIVERY'; END IF;
 IF (SELECT count(*) FROM pg_temp.creator_test_runtime_input)<>1 THEN RAISE EXCEPTION 'AMBIGUOUS_DELIVERY'; END IF;
 SELECT binding INTO STRICT b FROM creator_relay_test_private.sealed_test_window WHERE singleton AND closed_at IS NULL;
 SELECT payload INTO p FROM pg_temp.creator_test_runtime_input;
 IF p IS NULL OR jsonb_typeof(p)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(p))<>3 OR p->'sealedBinding' IS DISTINCT FROM b
 OR jsonb_typeof(p->'storageSessions')<>'object' OR (SELECT count(*) FROM jsonb_object_keys(p->'storageSessions'))<>2
 OR coalesce(p->'storageSessions'->>'upload','')!~'^[A-Za-z0-9_-]+[.][A-Za-z0-9_-]+[.][A-Za-z0-9_-]+$'
 OR coalesce(p->'storageSessions'->>'readback','')!~'^[A-Za-z0-9_-]+[.][A-Za-z0-9_-]+[.][A-Za-z0-9_-]+$'
 OR p->'storageSessions'->>'upload'=p->'storageSessions'->>'readback'
 OR coalesce(p->>'publishableKey','')!~'^sb_publishable_[A-Za-z0-9_-]+$' OR length(p->>'publishableKey')>271 OR octet_length(p::text)>49152
 OR clock_timestamp()>=to_timestamp(least((b->'upload'->>'startsAt')::bigint,(b->'readback'->>'startsAt')::bigint)) THEN RAISE EXCEPTION 'DELIVERY_REJECTED'; END IF;
 -- Storage JWT identity/expiry additionally checked by existing sealed runtime;
 -- real signature validity remains Auth/Storage's responsibility.
 CREATE TABLE creator_relay_test_private.runtime_delivery(singleton boolean PRIMARY KEY CHECK(singleton),payload jsonb NOT NULL);
 ALTER TABLE creator_relay_test_private.runtime_delivery ENABLE ROW LEVEL SECURITY;
 REVOKE ALL ON creator_relay_test_private.runtime_delivery FROM PUBLIC,anon,authenticated,service_role,creator_test_issuer,creator_test_consumer,creator_test_verifier;
 INSERT INTO creator_relay_test_private.runtime_delivery VALUES(true,p);
END $$;
CREATE FUNCTION creator_relay_test_private.relay_runtime_configuration(identity jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,creator_relay_test_private AS $$
DECLARE b jsonb; p jsonb; action text; phase text; BEGIN
 IF identity IS NULL OR jsonb_typeof(identity)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(identity))<>7 THEN RETURN NULL; END IF;
 action:=identity->>'action';phase:=CASE WHEN action='verify' THEN 'readback' ELSE 'upload' END;
 IF action IS NULL OR action NOT IN('issue','upload','verify') OR session_user<>(CASE WHEN action='verify' THEN 'creator_test_verifier_login' ELSE 'creator_test_issuer_login' END) THEN RETURN NULL; END IF;
 SELECT binding INTO b FROM creator_relay_test_private.sealed_test_window WHERE singleton AND closed_at IS NULL;
 IF b IS NULL OR identity->>'target' IS DISTINCT FROM 'preview' OR identity->>'projectId' IS DISTINCT FROM b->>'vercelProjectId'
 OR identity->>'id' IS DISTINCT FROM b->>'deploymentId' OR identity->>'url' IS DISTINCT FROM b->>'deploymentUrl'
 OR identity->>'commit' IS DISTINCT FROM b->>'commit' OR identity->>'branch' IS DISTINCT FROM 'fix/glitch-recovery-preflight-20261027'
 OR clock_timestamp()<to_timestamp((b->phase->>'startsAt')::bigint) OR clock_timestamp()>=to_timestamp((b->phase->>'expiresAt')::bigint) THEN RETURN NULL; END IF;
 SELECT payload INTO p FROM creator_relay_test_private.runtime_delivery WHERE singleton;
 IF p->'sealedBinding' IS DISTINCT FROM b THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('sealedBinding',b,'phase',phase,'storageSessions',jsonb_build_object(phase,p->'storageSessions'->phase),'publishableKey',p->'publishableKey');
END $$;
REVOKE ALL ON FUNCTION creator_relay_test_private.relay_runtime_configuration(jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION creator_relay_test_private.relay_runtime_configuration(jsonb) TO creator_test_issuer,creator_test_verifier;
COMMIT;
-- No DELETE/UPDATE/runtime table grants. Existing sealed closeout's closed_at and
-- login revocation deny further reads; in-flight responses/tokens may survive.
-- Only the matching phase token is returned to its corresponding server login.
-- This added credential-read authority
-- and temporary token retention require explicit separate owner approval.
