-- PROPOSAL / DISPOSABLE ONLY. Not a hosted migration or permission approval.
DO $$ BEGIN IF current_database()<>'glitch_creator_evidence_test' THEN RAISE EXCEPTION 'DISPOSABLE_DATABASE_REQUIRED'; END IF; END $$;
CREATE SCHEMA creator_private;
REVOKE ALL ON SCHEMA creator_private FROM PUBLIC;
CREATE TABLE creator_private.relay_reservations (
 object_key text PRIMARY KEY CHECK(object_key='global/442809233/4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf/9aa57beb2b897cc175a536f170ddb25c0c8bed8ed6620c7087d8a7fb834f7d30.json'),
 record jsonb NOT NULL CHECK(jsonb_typeof(record)='object'),
 expires_at timestamptz NOT NULL,
 claimed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(expires_at>claimed_at AND expires_at<=claimed_at+interval '5 minutes')
);
CREATE TABLE creator_private.relay_consumptions (
 object_key text PRIMARY KEY REFERENCES creator_private.relay_reservations(object_key),
 token_hash text NOT NULL CHECK(token_hash ~ '^[a-f0-9]{64}$'), consumed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE creator_private.relay_readbacks (
 object_key text PRIMARY KEY REFERENCES creator_private.relay_consumptions(object_key),
 token_hash text NOT NULL CHECK(token_hash ~ '^[a-f0-9]{64}$'), claimed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE creator_private.relay_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_private.relay_consumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_private.relay_readbacks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA creator_private FROM PUBLIC;
CREATE FUNCTION creator_private.relay_reserve(p jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,creator_private AS $$
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
CREATE FUNCTION creator_private.relay_consume(p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,creator_private AS $$
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
CREATE FUNCTION creator_private.relay_readback(p jsonb,p_deadline bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,creator_private AS $$
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
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA creator_private FROM PUBLIC;
-- No role membership or policies are installed here. Parent must review distinct
-- server-only issuer/uploader/verifier roles and their exact INSERT/SELECT needs.
-- No UPDATE/DELETE, public Data API exposure, service_role fallback or expiry cleanup.
