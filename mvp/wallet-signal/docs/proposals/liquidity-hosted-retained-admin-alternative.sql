-- PROPOSED ALTERNATIVE / UNAPPROVED for acwmtobcbpkjfqiatyke ONLY.
-- Retains ONLY unavoidable bootstrap-granted postgres ADMIN memberships.
-- This is a separate owner-policy choice, NOT approval to apply hosted SQL.
-- Project identity MUST be verified by the authenticated connector/dashboard;
-- current_database/current_user are compatibility checks, NOT project proof.
-- Outside automatic migrations. Execute only the reviewed hash after approval.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='8s';
SET LOCAL search_path=pg_catalog,public;
-- PostgreSQL 17 grants the creator administrative membership; request SET
-- only for this transaction, then remove setup grants before commit.
-- The alternative retains exact bootstrap ADMIN grants without INHERIT or SET.
SET LOCAL createrole_self_grant='set';
DO $$ DECLARE t text; r record; actual text; BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' OR current_database()<>'postgres' THEN
  RAISE EXCEPTION 'UNEXPECTED_SETUP_SESSION'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE oid=10::oid AND rolsuper) THEN RAISE EXCEPTION 'BOOTSTRAP_GRANTOR_DRIFT'; END IF;
 IF NOT (SELECT rolcreaterole FROM pg_roles WHERE rolname=current_user)
 OR NOT has_database_privilege(current_user,current_database(),'CREATE') THEN RAISE EXCEPTION 'ADMIN_CAPABILITY_MISSING'; END IF;
 IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='liquidity_fencing_private')
 OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('liquidity_fencing_code_owner','liquidity_fencing_executor','liquidity_fencing_reviewer')) THEN
  RAISE EXCEPTION 'CLOSED_SETUP_NAME_CONFLICT'; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('anon','authenticated') AND (rolsuper OR rolbypassrls))
 OR (SELECT count(*) FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role'))<>3 THEN RAISE EXCEPTION 'LEGACY_ROLE_DRIFT'; END IF;
 FOREACH t IN ARRAY ARRAY['liquidity_evidence_checkpoints','liquidity_evidence_snapshots'] LOOP
  SELECT c.* INTO r FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=t;
  IF NOT FOUND OR r.relkind<>'r' OR r.relowner<>'postgres'::regrole OR NOT r.relrowsecurity OR r.relforcerowsecurity THEN RAISE EXCEPTION 'LEGACY_TABLE_DRIFT'; END IF;
  IF EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=r.oid) OR EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=r.oid AND NOT tgisinternal) THEN RAISE EXCEPTION 'LEGACY_POLICY_TRIGGER_DRIFT'; END IF;
  IF EXISTS(SELECT 1 FROM aclexplode(coalesce(r.relacl,acldefault('r',r.relowner))) WHERE grantee NOT IN ('postgres'::regrole,'service_role'::regrole)) THEN RAISE EXCEPTION 'LEGACY_TABLE_ACL_DRIFT'; END IF;
  IF NOT has_table_privilege('service_role',r.oid,'SELECT') OR NOT has_table_privilege('service_role',r.oid,'INSERT') OR NOT has_table_privilege('service_role',r.oid,'UPDATE') OR NOT has_table_privilege('service_role',r.oid,'DELETE') THEN RAISE EXCEPTION 'LEGACY_SERVICE_ACL_DRIFT'; END IF;
  IF EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=r.oid AND (NOT convalidated OR contype NOT IN ('c','p')))
  OR (SELECT count(*) FROM pg_constraint WHERE conrelid=r.oid)<>(CASE t WHEN 'liquidity_evidence_checkpoints' THEN 5 ELSE 3 END)
  OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=r.oid AND contype='p' AND pg_get_constraintdef(oid)=CASE t WHEN 'liquidity_evidence_checkpoints' THEN 'PRIMARY KEY (mint)' ELSE 'PRIMARY KEY (id)' END)
  OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=r.oid AND pg_get_constraintdef(oid)=$q$CHECK ((mint ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'::text))$q$)
  OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=r.oid AND pg_get_constraintdef(oid)=$q$CHECK ((status = ANY (ARRAY['partial'::text, 'account_checks_completed'::text])))$q$)
  OR (t='liquidity_evidence_checkpoints' AND (
    NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=r.oid AND pg_get_constraintdef(oid)='CHECK ((reported_pool_count >= 0))')
    OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=r.oid AND pg_get_constraintdef(oid)='CHECK ((checked_pool_count >= 0))'))) THEN RAISE EXCEPTION 'LEGACY_CONSTRAINT_DRIFT'; END IF;
  SELECT string_agg(a.attname||':'||format_type(a.atttypid,a.atttypmod)||':'||a.attnotnull::text||':'||a.attidentity::text||':'||coalesce(pg_get_expr(d.adbin,d.adrelid),''),'|' ORDER BY a.attnum) INTO actual
   FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=r.oid AND a.attnum>0 AND NOT a.attisdropped;
  IF actual<>(CASE t WHEN 'liquidity_evidence_checkpoints' THEN 'mint:text:true::|schema_version:integer:true::1|status:text:true::|observed_at:timestamp with time zone:true::|reported_pool_count:integer:false::|checked_pool_count:integer:true::0|evidence:jsonb:true::|updated_at:timestamp with time zone:true::now()'
  ELSE 'id:bigint:true:a:|mint:text:true::|observed_at:timestamp with time zone:true::|recorded_at:timestamp with time zone:true::now()|status:text:true::|evidence:jsonb:true::' END) THEN RAISE EXCEPTION 'LEGACY_COLUMN_DRIFT'; END IF;
 END LOOP;
 IF pg_get_serial_sequence('public.liquidity_evidence_snapshots','id')<>'public.liquidity_evidence_snapshots_id_seq' THEN RAISE EXCEPTION 'LEGACY_SEQUENCE_DRIFT'; END IF;
 SELECT * INTO r FROM pg_class WHERE oid='public.liquidity_evidence_snapshots_id_seq'::regclass;
 IF r.relkind<>'S' OR r.relowner<>'postgres'::regrole OR EXISTS(SELECT 1 FROM aclexplode(r.relacl) WHERE grantee NOT IN ('postgres'::regrole,'service_role'::regrole,'anon'::regrole,'authenticated'::regrole)) THEN RAISE EXCEPTION 'LEGACY_SEQUENCE_ACL_DRIFT'; END IF;
 FOREACH t IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF NOT has_sequence_privilege(t,r.oid,'SELECT') OR NOT has_sequence_privilege(t,r.oid,'USAGE') OR NOT has_sequence_privilege(t,r.oid,'UPDATE') THEN RAISE EXCEPTION 'LEGACY_SEQUENCE_RIGHTS_DRIFT'; END IF;
 END LOOP;
END $$;
-- Read catalog only; never copy checkpoint rows into the setup transaction.
CREATE TEMP TABLE lq_setup_catalog_before ON COMMIT DROP AS
 SELECT oid,relacl FROM pg_class WHERE oid IN ('public.liquidity_evidence_checkpoints'::regclass,'public.liquidity_evidence_snapshots'::regclass);

-- Unapplied closed setup; no activation.
-- Base fencing objects; the combined candidate also models sequence hardening.

CREATE SCHEMA liquidity_fencing_private;
REVOKE ALL ON SCHEMA liquidity_fencing_private FROM PUBLIC;
CREATE TABLE liquidity_fencing_private.lane (
 singleton boolean PRIMARY KEY CHECK(singleton),
 tip text NOT NULL CHECK(tip ~ '^[a-f0-9]{64}$'),
 pool text NOT NULL CHECK(pool ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
 epoch bigint NOT NULL DEFAULT 0 CHECK(epoch>=0),
 operation uuid, lease_until timestamptz,
 CHECK((operation IS NULL)=(lease_until IS NULL))
);
-- Deliberately EMPTY: no real tip, manifest, window or principal is fabricated.
CREATE TABLE liquidity_fencing_private.manifests (
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
CREATE TABLE liquidity_fencing_private.claims (
 operation uuid PRIMARY KEY REFERENCES liquidity_fencing_private.manifests,
 epoch bigint NOT NULL UNIQUE CHECK(epoch>0), claimed_at timestamptz NOT NULL
);
CREATE TABLE liquidity_fencing_private.reservations (
 operation uuid NOT NULL REFERENCES liquidity_fencing_private.claims,
 ordinal integer NOT NULL CHECK(ordinal>0), reserved_at timestamptz NOT NULL,
 PRIMARY KEY(operation,ordinal)
);
CREATE TABLE liquidity_fencing_private.artifacts (
 operation uuid PRIMARY KEY REFERENCES liquidity_fencing_private.claims,
 artifact_id text NOT NULL CHECK(artifact_id ~ '^[0-9]+$'),
 digest text NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'),
 kind text NOT NULL CHECK(kind IN ('history_candidate','replay_diagnostic','stage1_observation')),
 staged_at timestamptz NOT NULL
);
-- Separate, trusted review authority is UNRESOLVED. No runtime writer/grant exists.
-- A worker cannot supply an authenticated:true or accepted:true argument to admit.
CREATE TABLE liquidity_fencing_private.reviews (
 operation uuid PRIMARY KEY REFERENCES liquidity_fencing_private.artifacts,
 review_id uuid NOT NULL UNIQUE, artifact_id text NOT NULL,
 digest text NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'),
 parent_digest text NOT NULL CHECK(parent_digest ~ '^[a-f0-9]{64}$'),
 commit_sha text NOT NULL CHECK(commit_sha ~ '^[a-f0-9]{40}$'),
 run_id bigint NOT NULL CHECK(run_id>0), run_attempt integer NOT NULL CHECK(run_attempt>0),
 run_conclusion text NOT NULL CHECK(run_conclusion IN ('success','failed','unknown')),
 lineage_verified boolean NOT NULL, publication_reconciled boolean NOT NULL
);
CREATE TABLE liquidity_fencing_private.admissions (
 operation uuid PRIMARY KEY REFERENCES liquidity_fencing_private.reviews,
 review_id uuid NOT NULL UNIQUE, epoch bigint NOT NULL,
 parent_digest text NOT NULL, successor_digest text NOT NULL, admitted_at timestamptz NOT NULL
);
CREATE FUNCTION liquidity_fencing_private.claim(p_operation uuid,p_tip text) RETURNS text
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,liquidity_fencing_private AS $$
DECLARE l liquidity_fencing_private.lane%ROWTYPE; m liquidity_fencing_private.manifests%ROWTYPE; t timestamptz; e bigint;
BEGIN
 IF p_operation IS NULL OR p_tip IS NULL THEN RAISE EXCEPTION 'LQ_INVALID_CLAIM'; END IF;
 SELECT * INTO l FROM liquidity_fencing_private.lane WHERE singleton FOR UPDATE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'LQ_NOT_ENROLLED'; END IF;
 SELECT * INTO m FROM liquidity_fencing_private.manifests WHERE operation=p_operation FOR SHARE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'LQ_MANIFEST_MISSING'; END IF;
 t:=clock_timestamp();
 IF m.starts_at>t OR m.expires_at<=t OR l.tip<>p_tip OR m.parent_digest<>p_tip OR m.pool<>l.pool
 OR (l.lease_until IS NOT NULL AND l.lease_until>t) OR l.epoch=9223372036854775807
 OR EXISTS(SELECT FROM liquidity_fencing_private.claims WHERE operation=p_operation)
 THEN RAISE EXCEPTION 'LQ_CLAIM_CLOSED_OR_BUSY'; END IF;
 e:=l.epoch+1;
 INSERT INTO liquidity_fencing_private.claims VALUES(p_operation,e,t);
 UPDATE liquidity_fencing_private.lane SET epoch=e,operation=p_operation,lease_until=m.expires_at WHERE singleton;
 RETURN e::text;
END $$;
-- Internal invoker helper: caller must hold the lane lock in the same transaction.
CREATE FUNCTION liquidity_fencing_private.assert_live(p_operation uuid,p_epoch bigint) RETURNS liquidity_fencing_private.manifests
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,liquidity_fencing_private AS $$
DECLARE l liquidity_fencing_private.lane%ROWTYPE; m liquidity_fencing_private.manifests%ROWTYPE; t timestamptz;
BEGIN
 SELECT * INTO l FROM liquidity_fencing_private.lane WHERE singleton FOR UPDATE NOWAIT;
 IF NOT FOUND OR p_operation IS NULL OR p_epoch IS NULL OR l.operation IS DISTINCT FROM p_operation OR l.epoch<>p_epoch THEN RAISE EXCEPTION 'LQ_FENCED'; END IF;
 SELECT * INTO m FROM liquidity_fencing_private.manifests WHERE operation=p_operation FOR SHARE NOWAIT;
 t:=clock_timestamp();
 IF NOT FOUND OR l.lease_until IS NULL OR l.lease_until<=t OR m.expires_at<=t OR m.starts_at>t OR m.pool<>l.pool OR m.parent_digest<>l.tip THEN RAISE EXCEPTION 'LQ_EXPIRED'; END IF;
 RETURN m;
END $$;
CREATE FUNCTION liquidity_fencing_private.reserve(p_operation uuid,p_epoch bigint,p_ordinal integer) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,liquidity_fencing_private AS $$
DECLARE m liquidity_fencing_private.manifests%ROWTYPE; n integer;
BEGIN
 m:=liquidity_fencing_private.assert_live(p_operation,p_epoch);
 SELECT count(*) INTO n FROM liquidity_fencing_private.reservations WHERE operation=p_operation;
 IF p_ordinal IS NULL OR p_ordinal<>n+1 OR p_ordinal>m.request_ceiling THEN RAISE EXCEPTION 'LQ_RESERVATION_CONFLICT_OR_BUDGET'; END IF;
 INSERT INTO liquidity_fencing_private.reservations VALUES(p_operation,p_ordinal,clock_timestamp());
 RETURN p_ordinal;
END $$;
CREATE FUNCTION liquidity_fencing_private.stage(p_operation uuid,p_epoch bigint,p_artifact text,p_digest text,p_kind text) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,liquidity_fencing_private AS $$
DECLARE m liquidity_fencing_private.manifests%ROWTYPE;
BEGIN
 m:=liquidity_fencing_private.assert_live(p_operation,p_epoch);
 IF p_kind IS NULL OR p_kind<>(CASE m.purpose WHEN 'history' THEN 'history_candidate' WHEN 'replay' THEN 'replay_diagnostic' ELSE 'stage1_observation' END) THEN RAISE EXCEPTION 'LQ_ARTIFACT_KIND_MISMATCH'; END IF;
 INSERT INTO liquidity_fencing_private.artifacts VALUES(p_operation,p_artifact,p_digest,p_kind,clock_timestamp());
END $$;
CREATE FUNCTION liquidity_fencing_private.admit(p_operation uuid,p_epoch bigint,p_expected_tip text) RETURNS text
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,liquidity_fencing_private AS $$
DECLARE m liquidity_fencing_private.manifests%ROWTYPE; a liquidity_fencing_private.artifacts%ROWTYPE; r liquidity_fencing_private.reviews%ROWTYPE; current_tip text;
BEGIN
 m:=liquidity_fencing_private.assert_live(p_operation,p_epoch);
 SELECT tip INTO current_tip FROM liquidity_fencing_private.lane WHERE singleton;
 SELECT * INTO a FROM liquidity_fencing_private.artifacts WHERE operation=p_operation FOR SHARE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'LQ_ARTIFACT_MISSING'; END IF;
 SELECT * INTO r FROM liquidity_fencing_private.reviews WHERE operation=p_operation FOR SHARE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'LQ_REVIEW_MISSING'; END IF;
 IF p_expected_tip IS NULL OR current_tip<>p_expected_tip OR m.parent_digest<>p_expected_tip
 OR m.purpose<>'history' OR a.kind<>'history_candidate' OR r.parent_digest<>p_expected_tip
 OR r.artifact_id<>a.artifact_id OR r.digest<>a.digest OR r.commit_sha<>m.commit_sha
 OR r.run_id<>m.run_id OR r.run_attempt<>m.run_attempt OR r.run_conclusion<>'success'
 OR r.lineage_verified IS NOT TRUE OR r.publication_reconciled IS NOT TRUE
 THEN RAISE EXCEPTION 'LQ_QUARANTINED'; END IF;
 -- Recheck after all row locks/review reads. No transaction-start now() expiry.
 PERFORM liquidity_fencing_private.assert_live(p_operation,p_epoch);
 INSERT INTO liquidity_fencing_private.admissions VALUES(p_operation,r.review_id,p_epoch,p_expected_tip,a.digest,clock_timestamp());
 UPDATE liquidity_fencing_private.lane SET tip=a.digest,operation=NULL,lease_until=NULL WHERE singleton;
 RETURN a.digest;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['lane','manifests','claims','reservations','artifacts','reviews','admissions'] LOOP
  EXECUTE format('ALTER TABLE liquidity_fencing_private.%I ENABLE ROW LEVEL SECURITY',t);
 END LOOP;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA liquidity_fencing_private FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA liquidity_fencing_private FROM PUBLIC;
-- Narrow authority definitions, derived offline from reviewed disposable model.

CREATE ROLE liquidity_fencing_code_owner NOLOGIN PASSWORD NULL CONNECTION LIMIT 0 NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE liquidity_fencing_executor NOLOGIN PASSWORD NULL CONNECTION LIMIT 0 NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE liquidity_fencing_reviewer NOLOGIN PASSWORD NULL CONNECTION LIMIT 0 NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
-- No passwords/login activation, manifests or bindings are supplied.
-- Setup-only grants are removed; exact bootstrap ADMIN memberships remain.
CREATE TABLE liquidity_fencing_private.authorities (
 operation uuid PRIMARY KEY REFERENCES liquidity_fencing_private.manifests,
 executor_role name NOT NULL, reviewer_role name NOT NULL,
 CHECK(executor_role<>reviewer_role)
);
ALTER TABLE liquidity_fencing_private.authorities ENABLE ROW LEVEL SECURITY;
ALTER FUNCTION liquidity_fencing_private.claim(uuid,text) RENAME TO claim_internal;
ALTER FUNCTION liquidity_fencing_private.reserve(uuid,bigint,integer) RENAME TO reserve_internal;
ALTER FUNCTION liquidity_fencing_private.stage(uuid,bigint,text,text,text) RENAME TO stage_internal;
ALTER FUNCTION liquidity_fencing_private.admit(uuid,bigint,text) RENAME TO admit_internal;
CREATE FUNCTION liquidity_fencing_private.authorize(p_operation uuid,p_action text) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,liquidity_fencing_private AS $$
DECLARE a liquidity_fencing_private.authorities%ROWTYPE;
BEGIN
 SELECT * INTO a FROM liquidity_fencing_private.authorities WHERE operation=p_operation;
 IF NOT FOUND OR p_action IS NULL OR
 NOT (CASE p_action WHEN 'execute' THEN session_user=a.executor_role
 WHEN 'review' THEN session_user=a.reviewer_role
 WHEN 'read' THEN session_user IN (a.executor_role,a.reviewer_role) ELSE false END)
 THEN RAISE EXCEPTION 'LQ_SESSION_AUTHORITY_DENIED'; END IF;
END $$;
CREATE FUNCTION liquidity_fencing_private.claim(p_operation uuid,p_tip text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,liquidity_fencing_private AS $$
BEGIN PERFORM liquidity_fencing_private.authorize(p_operation,'execute');RETURN liquidity_fencing_private.claim_internal(p_operation,p_tip);END $$;
CREATE FUNCTION liquidity_fencing_private.reserve(p_operation uuid,p_epoch bigint,p_ordinal integer) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,liquidity_fencing_private AS $$
BEGIN PERFORM liquidity_fencing_private.authorize(p_operation,'execute');RETURN liquidity_fencing_private.reserve_internal(p_operation,p_epoch,p_ordinal);END $$;
CREATE FUNCTION liquidity_fencing_private.stage(p_operation uuid,p_epoch bigint,p_artifact text,p_digest text,p_kind text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,liquidity_fencing_private AS $$
BEGIN PERFORM liquidity_fencing_private.authorize(p_operation,'execute');PERFORM liquidity_fencing_private.stage_internal(p_operation,p_epoch,p_artifact,p_digest,p_kind);END $$;
CREATE FUNCTION liquidity_fencing_private.record_review(p_operation uuid,p_review uuid,p_artifact text,p_digest text,p_parent text,p_commit text,p_run bigint,p_attempt integer,p_conclusion text,p_lineage boolean,p_reconciled boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,liquidity_fencing_private AS $$
BEGIN
 PERFORM liquidity_fencing_private.authorize(p_operation,'review');
 INSERT INTO liquidity_fencing_private.reviews VALUES(p_operation,p_review,p_artifact,p_digest,p_parent,p_commit,p_run,p_attempt,p_conclusion,p_lineage,p_reconciled);
END $$;
CREATE FUNCTION liquidity_fencing_private.admit(p_operation uuid,p_epoch bigint,p_tip text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,liquidity_fencing_private AS $$
BEGIN PERFORM liquidity_fencing_private.authorize(p_operation,'review');RETURN liquidity_fencing_private.admit_internal(p_operation,p_epoch,p_tip);END $$;
CREATE FUNCTION liquidity_fencing_private.read_receipt(p_operation uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,liquidity_fencing_private AS $$
BEGIN
 PERFORM liquidity_fencing_private.authorize(p_operation,'read');
 RETURN jsonb_build_object('claim',(SELECT to_jsonb(c) FROM liquidity_fencing_private.claims c WHERE operation=p_operation),'artifact',(SELECT to_jsonb(a) FROM liquidity_fencing_private.artifacts a WHERE operation=p_operation),'admission',(SELECT to_jsonb(a) FROM liquidity_fencing_private.admissions a WHERE operation=p_operation));
END $$;
-- Apply explicit revokes AFTER creation: schema-local default ACL revokes cannot
-- cancel pre-existing global default grants from another object-creator role.
REVOKE ALL ON ALL TABLES IN SCHEMA liquidity_fencing_private FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA liquidity_fencing_private FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA liquidity_fencing_private FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON SCHEMA liquidity_fencing_private FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA liquidity_fencing_private TO liquidity_fencing_code_owner,liquidity_fencing_executor,liquidity_fencing_reviewer;
GRANT SELECT ON ALL TABLES IN SCHEMA liquidity_fencing_private TO liquidity_fencing_code_owner;
GRANT UPDATE ON liquidity_fencing_private.lane TO liquidity_fencing_code_owner;
-- PostgreSQL row locks require UPDATE privilege on at least one column. Give
-- only the non-login code owner that minimum; RLS forbids actual row updates.
GRANT UPDATE(operation) ON liquidity_fencing_private.manifests,liquidity_fencing_private.artifacts,liquidity_fencing_private.reviews TO liquidity_fencing_code_owner;
GRANT INSERT ON liquidity_fencing_private.claims,liquidity_fencing_private.reservations,liquidity_fencing_private.artifacts,liquidity_fencing_private.reviews,liquidity_fencing_private.admissions TO liquidity_fencing_code_owner;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA liquidity_fencing_private TO liquidity_fencing_code_owner;
-- Nonsuperuser ALTER FUNCTION OWNER requires membership and schema CREATE.
-- Temporary setup-only authority is revoked before commit.
GRANT CREATE ON SCHEMA liquidity_fencing_private TO liquidity_fencing_code_owner;
DO $$ DECLARE t text; f record; BEGIN
 FOREACH t IN ARRAY ARRAY['lane','manifests','claims','reservations','artifacts','reviews','admissions','authorities'] LOOP
  EXECUTE format('CREATE POLICY code_read ON liquidity_fencing_private.%I FOR SELECT TO liquidity_fencing_code_owner USING (true)',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['manifests','artifacts','reviews'] LOOP
  EXECUTE format('CREATE POLICY code_lock_only ON liquidity_fencing_private.%I FOR UPDATE TO liquidity_fencing_code_owner USING (true) WITH CHECK (false)',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['claims','reservations','artifacts','reviews','admissions'] LOOP
  EXECUTE format('CREATE POLICY code_insert ON liquidity_fencing_private.%I FOR INSERT TO liquidity_fencing_code_owner WITH CHECK (true)',t);
 END LOOP;
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='liquidity_fencing_private' AND p.prosecdef LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO liquidity_fencing_code_owner',f.signature);
 END LOOP;
END $$;
CREATE POLICY code_update_lane ON liquidity_fencing_private.lane FOR UPDATE TO liquidity_fencing_code_owner USING (true) WITH CHECK (true);
SET LOCAL ROLE liquidity_fencing_code_owner;
GRANT EXECUTE ON FUNCTION liquidity_fencing_private.claim(uuid,text),liquidity_fencing_private.reserve(uuid,bigint,integer),liquidity_fencing_private.stage(uuid,bigint,text,text,text) TO liquidity_fencing_executor;
GRANT EXECUTE ON FUNCTION liquidity_fencing_private.record_review(uuid,uuid,text,text,text,text,bigint,integer,text,boolean,boolean),liquidity_fencing_private.admit(uuid,bigint,text) TO liquidity_fencing_reviewer;
GRANT EXECUTE ON FUNCTION liquidity_fencing_private.read_receipt(uuid) TO liquidity_fencing_executor,liquidity_fencing_reviewer;
-- Only this new dedicated owner's defaults are adjusted; shared defaults remain.
ALTER DEFAULT PRIVILEGES FOR ROLE liquidity_fencing_code_owner REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
RESET ROLE;
-- Narrow legacy sequence hardening, explicitly included in this proposal. Existing table ACLs untouched.
REVOKE SELECT,USAGE,UPDATE ON SEQUENCE public.liquidity_evidence_snapshots_id_seq FROM anon,authenticated;

REVOKE CREATE ON SCHEMA liquidity_fencing_private FROM liquidity_fencing_code_owner;
REVOKE liquidity_fencing_code_owner,liquidity_fencing_executor,liquidity_fencing_reviewer FROM postgres;
DO $$ DECLARE t text; n bigint; r record; BEGIN
 IF (SELECT count(*) FROM pg_class WHERE relnamespace='liquidity_fencing_private'::regnamespace AND relkind='r' AND relrowsecurity)<>8 THEN RAISE EXCEPTION 'CLOSED_TABLE_POSTCONDITION'; END IF;
 FOREACH t IN ARRAY ARRAY['lane','manifests','authorities','claims','reservations','artifacts','reviews','admissions'] LOOP
  EXECUTE format('SELECT count(*) FROM liquidity_fencing_private.%I',t) INTO n;
  IF n<>0 THEN RAISE EXCEPTION 'ENROLLMENT_FORBIDDEN'; END IF;
 END LOOP;
 FOREACH t IN ARRAY ARRAY['liquidity_fencing_code_owner','liquidity_fencing_executor','liquidity_fencing_reviewer'] LOOP
  SELECT * INTO r FROM pg_roles WHERE rolname=t;
  IF r.rolcanlogin OR r.rolconnlimit<>0 OR r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication OR r.rolinherit THEN RAISE EXCEPTION 'ROLE_POSTCONDITION'; END IF;
  -- OID 10 is PostgreSQL's bootstrap superuser identity, not a caller setting.
  -- Do not substitute a same-named role or an arbitrary administrative grantor.
  IF (SELECT count(*) FROM pg_auth_members WHERE roleid=r.oid)<>1
  OR NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE roleid=r.oid AND member='postgres'::regrole AND grantor=10::oid AND admin_option AND NOT inherit_option AND NOT set_option)
  OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member=r.oid)
  OR has_schema_privilege(t,'liquidity_fencing_private','CREATE') THEN RAISE EXCEPTION 'EXACT_RETAINED_ADMIN_POSTCONDITION'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.relnamespace='liquidity_fencing_private'::regnamespace AND a.grantee NOT IN ('postgres'::regrole,'liquidity_fencing_code_owner'::regrole)) THEN RAISE EXCEPTION 'PRIVATE_TABLE_ACL_POSTCONDITION'; END IF;
 IF (SELECT count(*) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace='liquidity_fencing_private'::regnamespace)<>17 THEN RAISE EXCEPTION 'POLICY_POSTCONDITION'; END IF;
 FOREACH t IN ARRAY ARRAY['liquidity_fencing_executor','liquidity_fencing_reviewer'] LOOP
  IF (SELECT array_agg(proname::text ORDER BY proname) FROM pg_proc WHERE pronamespace='liquidity_fencing_private'::regnamespace AND has_function_privilege(t,oid,'EXECUTE')) IS DISTINCT FROM (CASE t WHEN 'liquidity_fencing_executor' THEN ARRAY['claim','read_receipt','reserve','stage'] ELSE ARRAY['admit','read_receipt','record_review'] END) THEN RAISE EXCEPTION 'FUNCTION_ALLOWLIST_POSTCONDITION'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace='liquidity_fencing_private'::regnamespace AND prosecdef AND (proowner<>'liquidity_fencing_code_owner'::regrole OR NOT ('search_path=pg_catalog, liquidity_fencing_private'=ANY(proconfig)))) THEN RAISE EXCEPTION 'DEFINER_POSTCONDITION'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN lq_setup_catalog_before b USING(oid) WHERE c.relacl IS DISTINCT FROM b.relacl) THEN RAISE EXCEPTION 'LEGACY_TABLE_ACL_CHANGED'; END IF;
 FOREACH t IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF has_schema_privilege(t,'liquidity_fencing_private','USAGE') OR EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace='liquidity_fencing_private'::regnamespace AND has_function_privilege(t,oid,'EXECUTE')) THEN RAISE EXCEPTION 'DEFAULT_FUNCTION_GRANT_LEAK'; END IF;
 END LOOP;
 FOREACH t IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF has_sequence_privilege(t,'public.liquidity_evidence_snapshots_id_seq','SELECT,USAGE,UPDATE') THEN RAISE EXCEPTION 'SEQUENCE_REVOKE_POSTCONDITION'; END IF;
 END LOOP;
 IF NOT has_sequence_privilege('service_role','public.liquidity_evidence_snapshots_id_seq','SELECT') OR NOT has_sequence_privilege('service_role','public.liquidity_evidence_snapshots_id_seq','USAGE') OR NOT has_sequence_privilege('service_role','public.liquidity_evidence_snapshots_id_seq','UPDATE') THEN RAISE EXCEPTION 'SERVICE_SEQUENCE_POSTCONDITION'; END IF;
END $$;
COMMIT;
