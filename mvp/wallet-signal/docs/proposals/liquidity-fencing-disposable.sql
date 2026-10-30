-- UNAPPLIED DESIGN CANDIDATE. NOT A HOSTED MIGRATION OR ACTIVATION SCRIPT.
-- No public Liquidity tables, existing roles or grants are changed.
BEGIN;
DO $$ BEGIN
 IF current_database()<>'glitch_liquidity_fencing_test' OR current_user<>'liquidity_local_owner'
 THEN RAISE EXCEPTION 'DISPOSABLE_LIQUIDITY_DATABASE_REQUIRED'; END IF;
END $$;
CREATE SCHEMA liquidity_proposal;
REVOKE ALL ON SCHEMA liquidity_proposal FROM PUBLIC;
CREATE TABLE liquidity_proposal.lane (
 singleton boolean PRIMARY KEY CHECK(singleton),
 tip text NOT NULL CHECK(tip ~ '^[a-f0-9]{64}$'),
 pool text NOT NULL CHECK(pool ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
 epoch bigint NOT NULL DEFAULT 0 CHECK(epoch>=0),
 operation uuid, lease_until timestamptz,
 CHECK((operation IS NULL)=(lease_until IS NULL))
);
-- Deliberately EMPTY: no real tip, manifest, window or principal is fabricated.
CREATE TABLE liquidity_proposal.manifests (
 operation uuid PRIMARY KEY, repository text NOT NULL CHECK(repository='doom404official-collab/DOOM404'),
 ref text NOT NULL CHECK(ref='refs/heads/fix/glitch-recovery-preflight-20261027'),
 commit_sha text NOT NULL CHECK(commit_sha ~ '^[a-f0-9]{40}$'),
 run_id bigint NOT NULL CHECK(run_id>0), run_attempt integer NOT NULL CHECK(run_attempt>0),
 purpose text NOT NULL CHECK(purpose IN ('history','replay','stage1')),
 pool text NOT NULL CHECK(pool ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
 parent_digest text NOT NULL CHECK(parent_digest ~ '^[a-f0-9]{64}$'),
 semantic_source_digest text NOT NULL CHECK(semantic_source_digest ~ '^[a-f0-9]{64}$'),
 request_ceiling integer NOT NULL CHECK(request_ceiling BETWEEN 1 AND 60),
 starts_at timestamptz NOT NULL, expires_at timestamptz NOT NULL,
 CHECK(expires_at>starts_at AND expires_at<=starts_at+interval '8 minutes'),
 CHECK(purpose<>'replay' OR request_ceiling<=20)
);
CREATE TABLE liquidity_proposal.claims (
 operation uuid PRIMARY KEY REFERENCES liquidity_proposal.manifests,
 epoch bigint NOT NULL UNIQUE CHECK(epoch>0), claimed_at timestamptz NOT NULL
);
CREATE TABLE liquidity_proposal.reservations (
 operation uuid NOT NULL REFERENCES liquidity_proposal.claims,
 ordinal integer NOT NULL CHECK(ordinal>0), reserved_at timestamptz NOT NULL,
 PRIMARY KEY(operation,ordinal)
);
CREATE TABLE liquidity_proposal.artifacts (
 operation uuid PRIMARY KEY REFERENCES liquidity_proposal.claims,
 artifact_id text NOT NULL CHECK(artifact_id ~ '^[0-9]+$'),
 digest text NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'),
 kind text NOT NULL CHECK(kind IN ('history_candidate','replay_diagnostic','stage1_observation')),
 staged_at timestamptz NOT NULL
);
-- Separate, trusted review authority is UNRESOLVED. No runtime writer/grant exists.
-- A worker cannot supply an authenticated:true or accepted:true argument to admit.
CREATE TABLE liquidity_proposal.reviews (
 operation uuid PRIMARY KEY REFERENCES liquidity_proposal.artifacts,
 review_id uuid NOT NULL UNIQUE, artifact_id text NOT NULL,
 digest text NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'),
 parent_digest text NOT NULL CHECK(parent_digest ~ '^[a-f0-9]{64}$'),
 commit_sha text NOT NULL CHECK(commit_sha ~ '^[a-f0-9]{40}$'),
 run_id bigint NOT NULL CHECK(run_id>0), run_attempt integer NOT NULL CHECK(run_attempt>0),
 run_conclusion text NOT NULL CHECK(run_conclusion IN ('success','failed','unknown')),
 lineage_verified boolean NOT NULL, publication_reconciled boolean NOT NULL
);
CREATE TABLE liquidity_proposal.admissions (
 operation uuid PRIMARY KEY REFERENCES liquidity_proposal.reviews,
 review_id uuid NOT NULL UNIQUE, epoch bigint NOT NULL,
 parent_digest text NOT NULL, successor_digest text NOT NULL, admitted_at timestamptz NOT NULL
);
CREATE FUNCTION liquidity_proposal.claim(p_operation uuid,p_tip text) RETURNS text
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,liquidity_proposal AS $$
DECLARE l liquidity_proposal.lane%ROWTYPE; m liquidity_proposal.manifests%ROWTYPE; t timestamptz; e bigint;
BEGIN
 IF p_operation IS NULL OR p_tip IS NULL THEN RAISE EXCEPTION 'LQ_INVALID_CLAIM'; END IF;
 SELECT * INTO l FROM liquidity_proposal.lane WHERE singleton FOR UPDATE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'LQ_NOT_ENROLLED'; END IF;
 SELECT * INTO m FROM liquidity_proposal.manifests WHERE operation=p_operation FOR SHARE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'LQ_MANIFEST_MISSING'; END IF;
 t:=clock_timestamp();
 IF m.starts_at>t OR m.expires_at<=t OR l.tip<>p_tip OR m.parent_digest<>p_tip OR m.pool<>l.pool
 OR (l.lease_until IS NOT NULL AND l.lease_until>t) OR l.epoch=9223372036854775807
 OR EXISTS(SELECT FROM liquidity_proposal.claims WHERE operation=p_operation)
 THEN RAISE EXCEPTION 'LQ_CLAIM_CLOSED_OR_BUSY'; END IF;
 e:=l.epoch+1;
 INSERT INTO liquidity_proposal.claims VALUES(p_operation,e,t);
 UPDATE liquidity_proposal.lane SET epoch=e,operation=p_operation,lease_until=m.expires_at WHERE singleton;
 RETURN e::text;
END $$;
-- Internal invoker helper: caller must hold the lane lock in the same transaction.
CREATE FUNCTION liquidity_proposal.assert_live(p_operation uuid,p_epoch bigint) RETURNS liquidity_proposal.manifests
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,liquidity_proposal AS $$
DECLARE l liquidity_proposal.lane%ROWTYPE; m liquidity_proposal.manifests%ROWTYPE; t timestamptz;
BEGIN
 SELECT * INTO l FROM liquidity_proposal.lane WHERE singleton FOR UPDATE NOWAIT;
 IF NOT FOUND OR p_operation IS NULL OR p_epoch IS NULL OR l.operation IS DISTINCT FROM p_operation OR l.epoch<>p_epoch THEN RAISE EXCEPTION 'LQ_FENCED'; END IF;
 SELECT * INTO m FROM liquidity_proposal.manifests WHERE operation=p_operation FOR SHARE NOWAIT;
 t:=clock_timestamp();
 IF NOT FOUND OR l.lease_until IS NULL OR l.lease_until<=t OR m.expires_at<=t OR m.starts_at>t OR m.pool<>l.pool OR m.parent_digest<>l.tip THEN RAISE EXCEPTION 'LQ_EXPIRED'; END IF;
 RETURN m;
END $$;
CREATE FUNCTION liquidity_proposal.reserve(p_operation uuid,p_epoch bigint,p_ordinal integer) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,liquidity_proposal AS $$
DECLARE m liquidity_proposal.manifests%ROWTYPE; n integer;
BEGIN
 m:=liquidity_proposal.assert_live(p_operation,p_epoch);
 SELECT count(*) INTO n FROM liquidity_proposal.reservations WHERE operation=p_operation;
 IF p_ordinal IS NULL OR p_ordinal<>n+1 OR p_ordinal>m.request_ceiling THEN RAISE EXCEPTION 'LQ_RESERVATION_CONFLICT_OR_BUDGET'; END IF;
 INSERT INTO liquidity_proposal.reservations VALUES(p_operation,p_ordinal,clock_timestamp());
 RETURN p_ordinal;
END $$;
CREATE FUNCTION liquidity_proposal.stage(p_operation uuid,p_epoch bigint,p_artifact text,p_digest text,p_kind text) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,liquidity_proposal AS $$
DECLARE m liquidity_proposal.manifests%ROWTYPE;
BEGIN
 m:=liquidity_proposal.assert_live(p_operation,p_epoch);
 IF p_kind IS NULL OR p_kind<>(CASE m.purpose WHEN 'history' THEN 'history_candidate' WHEN 'replay' THEN 'replay_diagnostic' ELSE 'stage1_observation' END) THEN RAISE EXCEPTION 'LQ_ARTIFACT_KIND_MISMATCH'; END IF;
 INSERT INTO liquidity_proposal.artifacts VALUES(p_operation,p_artifact,p_digest,p_kind,clock_timestamp());
END $$;
CREATE FUNCTION liquidity_proposal.admit(p_operation uuid,p_epoch bigint,p_expected_tip text) RETURNS text
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,liquidity_proposal AS $$
DECLARE m liquidity_proposal.manifests%ROWTYPE; a liquidity_proposal.artifacts%ROWTYPE; r liquidity_proposal.reviews%ROWTYPE; current_tip text;
BEGIN
 m:=liquidity_proposal.assert_live(p_operation,p_epoch);
 SELECT tip INTO current_tip FROM liquidity_proposal.lane WHERE singleton;
 SELECT * INTO a FROM liquidity_proposal.artifacts WHERE operation=p_operation FOR SHARE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'LQ_ARTIFACT_MISSING'; END IF;
 SELECT * INTO r FROM liquidity_proposal.reviews WHERE operation=p_operation FOR SHARE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'LQ_REVIEW_MISSING'; END IF;
 IF p_expected_tip IS NULL OR current_tip<>p_expected_tip OR m.parent_digest<>p_expected_tip
 OR m.purpose<>'history' OR a.kind<>'history_candidate' OR r.parent_digest<>p_expected_tip
 OR r.artifact_id<>a.artifact_id OR r.digest<>a.digest OR r.commit_sha<>m.commit_sha
 OR r.run_id<>m.run_id OR r.run_attempt<>m.run_attempt OR r.run_conclusion<>'success'
 OR r.lineage_verified IS NOT TRUE OR r.publication_reconciled IS NOT TRUE
 THEN RAISE EXCEPTION 'LQ_QUARANTINED'; END IF;
 -- Recheck after all row locks/review reads. No transaction-start now() expiry.
 PERFORM liquidity_proposal.assert_live(p_operation,p_epoch);
 INSERT INTO liquidity_proposal.admissions VALUES(p_operation,r.review_id,p_epoch,p_expected_tip,a.digest,clock_timestamp());
 UPDATE liquidity_proposal.lane SET tip=a.digest,operation=NULL,lease_until=NULL WHERE singleton;
 RETURN a.digest;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['lane','manifests','claims','reservations','artifacts','reviews','admissions'] LOOP
  EXECUTE format('ALTER TABLE liquidity_proposal.%I ENABLE ROW LEVEL SECURITY',t);
 END LOOP;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA liquidity_proposal FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA liquidity_proposal FROM PUBLIC;
COMMIT;
