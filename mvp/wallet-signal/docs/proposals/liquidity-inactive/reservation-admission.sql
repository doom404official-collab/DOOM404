-- UNAPPLIED reservation-accounting extension AFTER the reviewed manifest reader.
-- Original ac65c786 and manifest-reader.sql remain unchanged.
-- Exact project target acwmtobcbpkjfqiatyke must be verified outside SQL.
-- Apply only after separately approved closed setup and this exact extension.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='8s';
SET LOCAL search_path=pg_catalog;
DO $$ DECLARE r record; BEGIN
 IF session_user<>'postgres' OR current_user<>'postgres' OR current_database()<>'postgres'
 OR (SELECT nspowner FROM pg_namespace WHERE nspname='liquidity_fencing_private') IS DISTINCT FROM 'postgres'::regrole
 OR to_regprocedure('liquidity_fencing_private.read_manifest(uuid)') IS NULL
 OR to_regprocedure('liquidity_fencing_private.read_accounting(uuid)') IS NOT NULL
 OR to_regprocedure('liquidity_fencing_private.admit_accounted(uuid,bigint,text,integer)') IS NOT NULL THEN RAISE EXCEPTION 'LQ_READER_SETUP_DRIFT'; END IF;
 FOR r IN SELECT * FROM pg_roles WHERE rolname IN ('liquidity_fencing_code_owner','liquidity_fencing_executor','liquidity_fencing_reviewer') LOOP
  IF r.rolcanlogin OR r.rolconnlimit<>0 OR r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb OR r.rolinherit OR r.rolreplication
  OR (SELECT count(*) FROM pg_auth_members WHERE roleid=r.oid)<>1
  OR NOT EXISTS(SELECT FROM pg_auth_members WHERE roleid=r.oid AND member='postgres'::regrole AND grantor=10::oid AND admin_option AND NOT inherit_option AND NOT set_option)
  OR EXISTS(SELECT FROM pg_auth_members WHERE member=r.oid)
  OR has_schema_privilege(r.oid,'liquidity_fencing_private','CREATE') THEN RAISE EXCEPTION 'LQ_READER_ROLE_DRIFT'; END IF;
 END LOOP;
 IF (SELECT count(*) FROM pg_roles WHERE rolname IN ('liquidity_fencing_code_owner','liquidity_fencing_executor','liquidity_fencing_reviewer'))<>3
 OR NOT EXISTS(SELECT FROM pg_roles WHERE oid=10 AND rolsuper)
 OR NOT EXISTS(SELECT FROM pg_proc WHERE oid='liquidity_fencing_private.authorize(uuid,text)'::regprocedure AND NOT prosecdef AND proowner='postgres'::regrole AND md5(prosrc)='08a29d35998d58cdc4e8a32de6ff3cdd' AND proconfig=ARRAY['search_path=pg_catalog, liquidity_fencing_private'])
 OR NOT EXISTS(SELECT FROM pg_proc WHERE oid='liquidity_fencing_private.admit(uuid,bigint,text)'::regprocedure AND prosecdef AND proowner='liquidity_fencing_code_owner'::regrole AND md5(prosrc)='a617c39504699ddfce89a1f73257bd5e' AND proconfig=ARRAY['search_path=pg_catalog, liquidity_fencing_private'])
 OR NOT EXISTS(SELECT FROM pg_proc WHERE oid='liquidity_fencing_private.read_receipt(uuid)'::regprocedure AND prosecdef AND proowner='liquidity_fencing_code_owner'::regrole AND md5(prosrc)='5d3106acd271fd04edfd54a664eb40fd' AND proconfig=ARRAY['search_path=pg_catalog, liquidity_fencing_private'])
 OR (SELECT count(*) FROM pg_class WHERE relnamespace='liquidity_fencing_private'::regnamespace AND relkind='r' AND relrowsecurity AND relowner='postgres'::regrole)<>8 THEN RAISE EXCEPTION 'LQ_READER_CONTRACT_DRIFT'; END IF;
 IF EXISTS(SELECT FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.relnamespace='liquidity_fencing_private'::regnamespace AND c.relkind='r' AND a.grantee NOT IN ('postgres'::regrole,'liquidity_fencing_code_owner'::regrole)) THEN RAISE EXCEPTION 'LQ_READER_TABLE_ACCESS_DRIFT'; END IF;

 IF EXISTS(SELECT FROM pg_class c CROSS JOIN pg_roles checked_role WHERE c.relnamespace='liquidity_fencing_private'::regnamespace AND c.relkind='r' AND checked_role.rolname IN ('liquidity_fencing_executor','liquidity_fencing_reviewer') AND (has_table_privilege(checked_role.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR has_any_column_privilege(checked_role.oid,c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))) THEN RAISE EXCEPTION 'LQ_READER_EFFECTIVE_ACCESS_DRIFT'; END IF;
END $$;
CREATE TEMP TABLE lq_accounting_acl_before ON COMMIT DROP AS SELECT oid,relacl FROM pg_class WHERE relnamespace='liquidity_fencing_private'::regnamespace AND relkind='r';
GRANT liquidity_fencing_code_owner TO postgres WITH ADMIN FALSE,INHERIT FALSE,SET TRUE;
GRANT CREATE ON SCHEMA liquidity_fencing_private TO liquidity_fencing_code_owner;
CREATE FUNCTION liquidity_fencing_private.read_accounting(p_operation uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,liquidity_fencing_private AS $$
BEGIN
 PERFORM liquidity_fencing_private.authorize(p_operation,'read');
 RETURN jsonb_build_object('receipt',liquidity_fencing_private.read_receipt(p_operation),
  'reservationCount',(SELECT count(*) FROM liquidity_fencing_private.reservations WHERE operation=p_operation));
END $$;
CREATE FUNCTION liquidity_fencing_private.admit_accounted(p_operation uuid,p_epoch bigint,p_tip text,p_request_delta integer) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,liquidity_fencing_private AS $$
DECLARE n integer;
BEGIN
 PERFORM liquidity_fencing_private.authorize(p_operation,'review');
 -- assert_live locks the lane; reserve uses the same lock, so the count cannot
 -- change between this check and admission. No caller count is trusted alone.
 PERFORM liquidity_fencing_private.assert_live(p_operation,p_epoch);
 SELECT count(*) INTO n FROM liquidity_fencing_private.reservations WHERE operation=p_operation;
 IF p_request_delta IS NULL OR p_request_delta<0 OR p_request_delta>60 OR p_request_delta<>n
 THEN RAISE EXCEPTION 'LQ_RESERVATION_ACCOUNTING_MISMATCH'; END IF;
 RETURN liquidity_fencing_private.admit(p_operation,p_epoch,p_tip);
END $$;
ALTER FUNCTION liquidity_fencing_private.read_accounting(uuid) OWNER TO liquidity_fencing_code_owner;
ALTER FUNCTION liquidity_fencing_private.admit_accounted(uuid,bigint,text,integer) OWNER TO liquidity_fencing_code_owner;
SET LOCAL ROLE liquidity_fencing_code_owner;
REVOKE ALL ON FUNCTION liquidity_fencing_private.read_accounting(uuid),liquidity_fencing_private.admit_accounted(uuid,bigint,text,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION liquidity_fencing_private.read_accounting(uuid) TO liquidity_fencing_executor,liquidity_fencing_reviewer;
GRANT EXECUTE ON FUNCTION liquidity_fencing_private.admit_accounted(uuid,bigint,text,integer) TO liquidity_fencing_reviewer;
REVOKE EXECUTE ON FUNCTION liquidity_fencing_private.admit(uuid,bigint,text) FROM liquidity_fencing_reviewer;
RESET ROLE;
REVOKE CREATE ON SCHEMA liquidity_fencing_private FROM liquidity_fencing_code_owner;
REVOKE liquidity_fencing_code_owner FROM postgres;
DO $$ BEGIN

 IF EXISTS(SELECT FROM pg_class c CROSS JOIN pg_roles checked_role WHERE c.relnamespace='liquidity_fencing_private'::regnamespace AND c.relkind='r' AND checked_role.rolname IN ('liquidity_fencing_executor','liquidity_fencing_reviewer') AND (has_table_privilege(checked_role.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR has_any_column_privilege(checked_role.oid,c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))) THEN RAISE EXCEPTION 'LQ_READER_EFFECTIVE_ACCESS_DRIFT'; END IF;
 IF EXISTS(SELECT FROM lq_accounting_acl_before b JOIN pg_class c USING(oid) WHERE c.relacl IS DISTINCT FROM b.relacl)
 OR (SELECT count(*) FROM pg_auth_members WHERE roleid IN ('liquidity_fencing_code_owner'::regrole,'liquidity_fencing_executor'::regrole,'liquidity_fencing_reviewer'::regrole))<>3
 OR EXISTS(SELECT FROM pg_auth_members WHERE roleid IN ('liquidity_fencing_code_owner'::regrole,'liquidity_fencing_executor'::regrole,'liquidity_fencing_reviewer'::regrole) AND (member<>'postgres'::regrole OR grantor<>10 OR NOT admin_option OR inherit_option OR set_option))
 OR EXISTS(SELECT FROM pg_auth_members WHERE member IN ('liquidity_fencing_code_owner'::regrole,'liquidity_fencing_executor'::regrole,'liquidity_fencing_reviewer'::regrole))
 OR EXISTS(SELECT FROM pg_roles WHERE rolname IN ('liquidity_fencing_code_owner','liquidity_fencing_executor','liquidity_fencing_reviewer') AND (rolcanlogin OR rolconnlimit<>0 OR rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolinherit OR rolreplication OR has_schema_privilege(oid,'liquidity_fencing_private','CREATE')))
 OR EXISTS(SELECT FROM pg_proc WHERE oid IN ('liquidity_fencing_private.read_accounting(uuid)'::regprocedure,'liquidity_fencing_private.admit_accounted(uuid,bigint,text,integer)'::regprocedure) AND (proowner<>'liquidity_fencing_code_owner'::regrole OR NOT prosecdef OR proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, liquidity_fencing_private']))
 OR has_function_privilege('liquidity_fencing_reviewer','liquidity_fencing_private.admit(uuid,bigint,text)','EXECUTE')
 OR has_function_privilege('liquidity_fencing_executor','liquidity_fencing_private.admit_accounted(uuid,bigint,text,integer)','EXECUTE')
 OR EXISTS(SELECT FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a WHERE p.oid IN ('liquidity_fencing_private.read_accounting(uuid)'::regprocedure,'liquidity_fencing_private.admit_accounted(uuid,bigint,text,integer)'::regprocedure) AND (a.grantee NOT IN ('liquidity_fencing_code_owner'::regrole,'liquidity_fencing_executor'::regrole,'liquidity_fencing_reviewer'::regrole) OR a.privilege_type<>'EXECUTE' OR a.is_grantable))
 THEN RAISE EXCEPTION 'LQ_READER_POSTCONDITION'; END IF;
END $$;
COMMIT;
