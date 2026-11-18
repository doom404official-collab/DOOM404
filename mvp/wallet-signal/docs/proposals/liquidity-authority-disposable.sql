-- DISPOSABLE-ONLY AUTHORITY DESIGN; NOT A HOSTED MIGRATION OR GRANT REQUEST.
BEGIN;
DO $$ BEGIN
 IF current_database()<>'glitch_liquidity_fencing_test' OR current_user<>'liquidity_local_owner'
 THEN RAISE EXCEPTION 'DISPOSABLE_LIQUIDITY_DATABASE_REQUIRED'; END IF;
END $$;
CREATE ROLE lq_test_code_owner NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE lq_test_executor NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE lq_test_reviewer NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
-- No passwords/login provisioning, memberships, manifests or bindings are supplied.
CREATE TABLE liquidity_proposal.authorities (
 operation uuid PRIMARY KEY REFERENCES liquidity_proposal.manifests,
 executor_role name NOT NULL, reviewer_role name NOT NULL,
 CHECK(executor_role<>reviewer_role)
);
ALTER TABLE liquidity_proposal.authorities ENABLE ROW LEVEL SECURITY;
ALTER FUNCTION liquidity_proposal.claim(uuid,text) RENAME TO claim_internal;
ALTER FUNCTION liquidity_proposal.reserve(uuid,bigint,integer) RENAME TO reserve_internal;
ALTER FUNCTION liquidity_proposal.stage(uuid,bigint,text,text,text) RENAME TO stage_internal;
ALTER FUNCTION liquidity_proposal.admit(uuid,bigint,text) RENAME TO admit_internal;
CREATE FUNCTION liquidity_proposal.authorize(p_operation uuid,p_action text) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,liquidity_proposal AS $$
DECLARE a liquidity_proposal.authorities%ROWTYPE;
BEGIN
 SELECT * INTO a FROM liquidity_proposal.authorities WHERE operation=p_operation;
 IF NOT FOUND OR p_action IS NULL OR
 NOT (CASE p_action WHEN 'execute' THEN session_user=a.executor_role
 WHEN 'review' THEN session_user=a.reviewer_role
 WHEN 'read' THEN session_user IN (a.executor_role,a.reviewer_role) ELSE false END)
 THEN RAISE EXCEPTION 'LQ_SESSION_AUTHORITY_DENIED'; END IF;
END $$;
CREATE FUNCTION liquidity_proposal.claim(p_operation uuid,p_tip text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,liquidity_proposal AS $$
BEGIN PERFORM liquidity_proposal.authorize(p_operation,'execute');RETURN liquidity_proposal.claim_internal(p_operation,p_tip);END $$;
CREATE FUNCTION liquidity_proposal.reserve(p_operation uuid,p_epoch bigint,p_ordinal integer) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,liquidity_proposal AS $$
BEGIN PERFORM liquidity_proposal.authorize(p_operation,'execute');RETURN liquidity_proposal.reserve_internal(p_operation,p_epoch,p_ordinal);END $$;
CREATE FUNCTION liquidity_proposal.stage(p_operation uuid,p_epoch bigint,p_artifact text,p_digest text,p_kind text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,liquidity_proposal AS $$
BEGIN PERFORM liquidity_proposal.authorize(p_operation,'execute');PERFORM liquidity_proposal.stage_internal(p_operation,p_epoch,p_artifact,p_digest,p_kind);END $$;
CREATE FUNCTION liquidity_proposal.record_review(p_operation uuid,p_review uuid,p_artifact text,p_digest text,p_parent text,p_commit text,p_run bigint,p_attempt integer,p_conclusion text,p_lineage boolean,p_reconciled boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,liquidity_proposal AS $$
BEGIN
 PERFORM liquidity_proposal.authorize(p_operation,'review');
 INSERT INTO liquidity_proposal.reviews VALUES(p_operation,p_review,p_artifact,p_digest,p_parent,p_commit,p_run,p_attempt,p_conclusion,p_lineage,p_reconciled);
END $$;
CREATE FUNCTION liquidity_proposal.admit(p_operation uuid,p_epoch bigint,p_tip text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,liquidity_proposal AS $$
BEGIN PERFORM liquidity_proposal.authorize(p_operation,'review');RETURN liquidity_proposal.admit_internal(p_operation,p_epoch,p_tip);END $$;
CREATE FUNCTION liquidity_proposal.read_receipt(p_operation uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,liquidity_proposal AS $$
BEGIN
 PERFORM liquidity_proposal.authorize(p_operation,'read');
 RETURN jsonb_build_object('claim',(SELECT to_jsonb(c) FROM liquidity_proposal.claims c WHERE operation=p_operation),'artifact',(SELECT to_jsonb(a) FROM liquidity_proposal.artifacts a WHERE operation=p_operation),'admission',(SELECT to_jsonb(a) FROM liquidity_proposal.admissions a WHERE operation=p_operation));
END $$;
-- Apply explicit revokes AFTER creation: schema-local default ACL revokes cannot
-- cancel pre-existing global default grants from another object-creator role.
REVOKE ALL ON ALL TABLES IN SCHEMA liquidity_proposal FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA liquidity_proposal FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA liquidity_proposal FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON SCHEMA liquidity_proposal FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA liquidity_proposal TO lq_test_code_owner,lq_test_executor,lq_test_reviewer;
GRANT SELECT ON ALL TABLES IN SCHEMA liquidity_proposal TO lq_test_code_owner;
GRANT UPDATE ON liquidity_proposal.lane TO lq_test_code_owner;
-- PostgreSQL row locks require UPDATE privilege on at least one column. Give
-- only the non-login code owner that minimum; RLS forbids actual row updates.
GRANT UPDATE(operation) ON liquidity_proposal.manifests,liquidity_proposal.artifacts,liquidity_proposal.reviews TO lq_test_code_owner;
GRANT INSERT ON liquidity_proposal.claims,liquidity_proposal.reservations,liquidity_proposal.artifacts,liquidity_proposal.reviews,liquidity_proposal.admissions TO lq_test_code_owner;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA liquidity_proposal TO lq_test_code_owner;
DO $$ DECLARE t text; f record; BEGIN
 FOREACH t IN ARRAY ARRAY['lane','manifests','claims','reservations','artifacts','reviews','admissions','authorities'] LOOP
  EXECUTE format('CREATE POLICY code_read ON liquidity_proposal.%I FOR SELECT TO lq_test_code_owner USING (true)',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['manifests','artifacts','reviews'] LOOP
  EXECUTE format('CREATE POLICY code_lock_only ON liquidity_proposal.%I FOR UPDATE TO lq_test_code_owner USING (true) WITH CHECK (false)',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['claims','reservations','artifacts','reviews','admissions'] LOOP
  EXECUTE format('CREATE POLICY code_insert ON liquidity_proposal.%I FOR INSERT TO lq_test_code_owner WITH CHECK (true)',t);
 END LOOP;
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='liquidity_proposal' AND p.prosecdef LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO lq_test_code_owner',f.signature);
 END LOOP;
END $$;
CREATE POLICY code_update_lane ON liquidity_proposal.lane FOR UPDATE TO lq_test_code_owner USING (true) WITH CHECK (true);
GRANT EXECUTE ON FUNCTION liquidity_proposal.claim(uuid,text),liquidity_proposal.reserve(uuid,bigint,integer),liquidity_proposal.stage(uuid,bigint,text,text,text) TO lq_test_executor;
GRANT EXECUTE ON FUNCTION liquidity_proposal.record_review(uuid,uuid,text,text,text,text,bigint,integer,text,boolean,boolean),liquidity_proposal.admit(uuid,bigint,text) TO lq_test_reviewer;
GRANT EXECUTE ON FUNCTION liquidity_proposal.read_receipt(uuid) TO lq_test_executor,lq_test_reviewer;
-- Only this new dedicated owner's defaults are adjusted; shared defaults remain.
ALTER DEFAULT PRIVILEGES FOR ROLE lq_test_code_owner REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
-- Narrow legacy sequence finding, modeled locally. Existing table ACLs untouched.
REVOKE SELECT,USAGE,UPDATE ON SEQUENCE public.liquidity_evidence_snapshots_id_seq FROM anon,authenticated;
COMMIT;
