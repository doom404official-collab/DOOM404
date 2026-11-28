-- UNAPPLIED DIFFERENTIAL CANDIDATE. NOT a workflow/migration/activation authority.
-- Render with the pure binding validator. BEGIN + one private pg_temp input row
-- precede this body; unresolved input always fails. No role/identity creation.
SELECT pg_advisory_xact_lock(404,608);
DO $$
DECLARE b jsonb; m jsonb; k text; item text; role_oid oid; group_oid oid; t oid; installed_policy record; r record;
 u uuid; v uuid; us timestamptz; ue timestamptz; rs timestamptz; re timestamptz;
 deny text; target text; upload_gate text; read_gate text; other_uid text; read_scope text; upload_scope text;
BEGIN
 IF to_regclass('pg_temp.creator_test_approved_bindings') IS NULL THEN RAISE EXCEPTION 'MISSING_SEALED_BINDING'; END IF;
 IF (SELECT count(*) FROM pg_temp.creator_test_approved_bindings)<>1 THEN RAISE EXCEPTION 'AMBIGUOUS_SEALED_BINDING'; END IF;
 SELECT binding INTO b FROM pg_temp.creator_test_approved_bindings;
 IF b IS NULL OR jsonb_typeof(b)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(b))<>14
 OR octet_length(b::text)>16384 OR jsonb_typeof(b->'version') IS DISTINCT FROM 'number' OR jsonb_typeof(b->'byteLength') IS DISTINCT FROM 'number'
 OR b->>'version' IS DISTINCT FROM '1' OR b->>'projectRef' IS DISTINCT FROM 'acwmtobcbpkjfqiatyke'
 OR b->>'vercelProjectId' IS DISTINCT FROM 'prj_AbsbiTw8Kc8axGpZ3FFpH9VvDS4e'
 OR coalesce(b->>'deploymentId','')!~'^dpl_[A-Za-z0-9]{1,100}$'
 OR coalesce(b->>'deploymentUrl','')!~'^https://doom404-wallet-signal-[a-z0-9]+-doom-404[.]vercel[.]app$'
 OR coalesce(b->>'commit','')!~'^[a-f0-9]{40}$' OR length(trim(coalesce(b->>'approvalRef',''))) NOT BETWEEN 1 AND 256
 OR b->>'objectKey' IS DISTINCT FROM 'relay-tests/creator-auth-flow-v1.json'
 OR b->>'payloadSha256' IS DISTINCT FROM 'c902eeb22e2fc05e6378f0c578686d991c1cc70d72aeefa61dc7ae0ffe1343dd'
 OR b->>'byteLength' IS DISTINCT FROM '75' THEN RAISE EXCEPTION 'INVALID_SEALED_BINDING'; END IF;
 FOREACH k IN ARRAY ARRAY['projectRef','vercelProjectId','deploymentId','deploymentUrl','commit','approvalRef','uploadUid','readUid','objectKey','payloadSha256'] LOOP
  IF jsonb_typeof(b->k) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'INVALID_BINDING_TYPE'; END IF;
 END LOOP;
 u:=(b->>'uploadUid')::uuid; v:=(b->>'readUid')::uuid;
 IF u IS NULL OR v IS NULL OR u=v OR (SELECT count(*) FROM auth.users WHERE id IN(u,v))<>2 THEN RAISE EXCEPTION 'WRONG_TEST_IDENTITIES'; END IF;
 FOREACH k IN ARRAY ARRAY['upload','readback'] LOOP
  m:=b->k;
  IF m IS NULL OR jsonb_typeof(m)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(m))<>17
   OR m->>'repository' IS DISTINCT FROM 'doom404official-collab/DOOM404' OR m->>'repository_id' IS DISTINCT FROM '1405094598'
   OR m->>'repository_owner' IS DISTINCT FROM 'doom404official-collab' OR m->>'repository_owner_id' IS DISTINCT FROM '335732040'
   OR m->>'ref' IS DISTINCT FROM 'refs/heads/fix/glitch-recovery-preflight-20261027'
   OR m->>'workflow_ref' IS DISTINCT FROM 'doom404official-collab/DOOM404/.github/workflows/creator-evidence-relay-test.yml@refs/heads/fix/glitch-recovery-preflight-20261027'
   OR m->>'sha' IS DISTINCT FROM b->>'commit' OR m->>'workflow_sha' IS DISTINCT FROM b->>'commit'
   OR m->>'run_attempt' IS DISTINCT FROM '1' OR coalesce(m->>'run_id','')!~'^[1-9][0-9]*$'
   OR m->>'event_name' IS DISTINCT FROM 'workflow_dispatch' OR m->>'runner_environment' IS DISTINCT FROM 'github-hosted'
   OR length(coalesce(m->>'environment',''))=0 OR length(coalesce(m->>'sub',''))=0
   OR m->>'audience' IS DISTINCT FROM (b->>'deploymentUrl')||'/api/creator-evidence-test/'||(CASE k WHEN 'upload' THEN 'upload' ELSE 'verify' END)
   OR coalesce(m->>'startsAt','')!~'^[0-9]{1,12}$' OR coalesce(m->>'expiresAt','')!~'^[0-9]{1,12}$'
  THEN RAISE EXCEPTION 'INVALID_RUN_BINDING'; END IF;
  IF jsonb_typeof(m->'startsAt') IS DISTINCT FROM 'number' OR jsonb_typeof(m->'expiresAt') IS DISTINCT FROM 'number' OR EXISTS(SELECT 1 FROM jsonb_each(m) e WHERE e.key NOT IN('startsAt','expiresAt') AND jsonb_typeof(e.value)<>'string') THEN RAISE EXCEPTION 'INVALID_MANIFEST_TYPE'; END IF;
  IF (m->>'expiresAt')::bigint<=(m->>'startsAt')::bigint OR (m->>'expiresAt')::bigint-(m->>'startsAt')::bigint>300
   OR to_timestamp((m->>'startsAt')::bigint)<clock_timestamp() THEN RAISE EXCEPTION 'WINDOW_NOT_FUTURE_OR_BOUNDED'; END IF;
 END LOOP;
 IF b->'upload'->>'run_id'=b->'readback'->>'run_id' THEN RAISE EXCEPTION 'SEPARATE_RUNS_REQUIRED'; END IF;
 us:=to_timestamp((b->'upload'->>'startsAt')::bigint);ue:=to_timestamp((b->'upload'->>'expiresAt')::bigint);
 rs:=to_timestamp((b->'readback'->>'startsAt')::bigint);re:=to_timestamp((b->'readback'->>'expiresAt')::bigint);
 IF to_regclass('creator_relay_test_private.sealed_test_window') IS NOT NULL THEN RAISE EXCEPTION 'SEALED_WINDOW_REPLAY_OR_CONFLICT'; END IF;
 LOCK TABLE creator_relay_test_private.relay_reservations,creator_relay_test_private.relay_consumptions,creator_relay_test_private.relay_readbacks IN ACCESS EXCLUSIVE MODE;
 IF EXISTS(SELECT 1 FROM creator_relay_test_private.relay_reservations) OR EXISTS(SELECT 1 FROM creator_relay_test_private.relay_consumptions) OR EXISTS(SELECT 1 FROM creator_relay_test_private.relay_readbacks) THEN RAISE EXCEPTION 'PRIOR_CLAIMS_REQUIRE_RECONCILIATION'; END IF;
 FOREACH item IN ARRAY ARRAY['issuer','consumer','verifier'] LOOP
  SELECT oid INTO STRICT role_oid FROM pg_roles WHERE rolname='creator_test_'||item||'_login';
  SELECT oid INTO STRICT group_oid FROM pg_roles WHERE rolname='creator_test_'||item;
  IF EXISTS(SELECT 1 FROM pg_authid WHERE oid IN(role_oid,group_oid) AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls))
   OR NOT EXISTS(SELECT 1 FROM pg_authid WHERE oid=role_oid AND rolcanlogin AND rolconnlimit=0 AND rolpassword IS NOT NULL)
   OR (SELECT count(*) FROM pg_auth_members WHERE member=role_oid)<>1
   OR NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=role_oid AND roleid=group_oid AND NOT admin_option AND inherit_option AND NOT set_option)
   OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member=group_oid)
   OR EXISTS(SELECT 1 FROM pg_authid WHERE oid=group_oid AND (rolcanlogin OR rolpassword IS NOT NULL))
   OR has_schema_privilege(role_oid,'creator_relay_test_private','CREATE')
  THEN RAISE EXCEPTION 'CLOSED_PROVISIONED_LOGINS_REQUIRED'; END IF;
  IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN('r','p','v','m','f') AND n.nspname NOT IN('pg_catalog','information_schema','creator_relay_test_private') AND n.nspname NOT LIKE 'pg_toast%' AND has_schema_privilege(role_oid,n.oid,'USAGE') AND has_table_privilege(role_oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) THEN RAISE EXCEPTION 'OUTSIDE_ACCESS_DRIFT'; END IF;
  IF EXISTS(SELECT 1 FROM pg_proc f JOIN pg_namespace n ON n.oid=f.pronamespace WHERE f.prosecdef AND n.nspname NOT IN('pg_catalog','information_schema','creator_relay_test_private') AND has_function_privilege(role_oid,f.oid,'EXECUTE') AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=f.oid AND d.refclassid='pg_extension'::regclass AND d.deptype='e')) THEN RAISE EXCEPTION 'OUTSIDE_FUNCTION_ACCESS_DRIFT'; END IF;
  FOR r IN SELECT c.oid,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='creator_relay_test_private' AND c.relkind='r' LOOP
   IF has_table_privilege(role_oid,r.oid,'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    OR has_table_privilege(role_oid,r.oid,'SELECT') IS DISTINCT FROM ((item='consumer' AND r.relname='relay_reservations') OR (item='verifier' AND r.relname IN('relay_reservations','relay_consumptions')))
    OR has_table_privilege(role_oid,r.oid,'INSERT') IS DISTINCT FROM (r.relname=CASE item WHEN 'issuer' THEN 'relay_reservations' WHEN 'consumer' THEN 'relay_consumptions' ELSE 'relay_readbacks' END)
   THEN RAISE EXCEPTION 'TABLE_PRIVILEGE_DRIFT'; END IF;
  END LOOP;
  FOR r IN SELECT p.oid,p.proname,p.prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='creator_relay_test_private' LOOP
   IF r.prosecdef OR has_function_privilege(role_oid,r.oid,'EXECUTE') IS DISTINCT FROM (r.proname=CASE item WHEN 'issuer' THEN 'relay_reserve' WHEN 'consumer' THEN 'relay_consume' ELSE 'relay_readback' END) THEN RAISE EXCEPTION 'FUNCTION_PRIVILEGE_DRIFT'; END IF;
  END LOOP;
 END LOOP;
 FOREACH item IN ARRAY ARRAY['relay_reservations','relay_consumptions','relay_readbacks'] LOOP
  t:=format('creator_relay_test_private.%I',item)::regclass;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=t) OR (SELECT count(*) FROM pg_policy WHERE polrelid=t)<>1
   OR NOT EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=t AND polname='closed_setup_guard' AND NOT polpermissive AND polcmd='*' AND polroles @> ARRAY['creator_test_issuer'::regrole::oid,'creator_test_consumer'::regrole::oid,'creator_test_verifier'::regrole::oid] AND cardinality(polroles)=3 AND pg_get_expr(polqual,polrelid)='false' AND pg_get_expr(polwithcheck,polrelid)='false') THEN RAISE EXCEPTION 'CLOSED_CLAIM_POLICIES_REQUIRED'; END IF;
 END LOOP;
 deny:=format('((auth.uid() IS DISTINCT FROM %L::uuid) AND (auth.uid() IS DISTINCT FROM %L::uuid))',u,v);
 SELECT * INTO STRICT installed_policy FROM pg_policy WHERE polrelid='storage.objects'::regclass AND polname='creator_test_closed_subjects';
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='storage.objects'::regclass) OR installed_policy.polpermissive OR installed_policy.polcmd<>'*' OR installed_policy.polroles<>ARRAY['authenticated'::regrole::oid]
  OR pg_get_expr(installed_policy.polqual,installed_policy.polrelid)<>deny OR pg_get_expr(installed_policy.polwithcheck,installed_policy.polrelid)<>deny THEN RAISE EXCEPTION 'INSTALLED_STORAGE_GUARD_CONFLICT'; END IF;
 CREATE TABLE creator_relay_test_private.sealed_test_window(singleton boolean PRIMARY KEY CHECK(singleton),binding jsonb NOT NULL,installed_at timestamptz NOT NULL DEFAULT clock_timestamp(),closed_at timestamptz);
 ALTER TABLE creator_relay_test_private.sealed_test_window ENABLE ROW LEVEL SECURITY;
 REVOKE ALL ON creator_relay_test_private.sealed_test_window FROM PUBLIC,creator_test_issuer,creator_test_consumer,creator_test_verifier;
 INSERT INTO creator_relay_test_private.sealed_test_window(singleton,binding) VALUES(true,b);
 upload_gate:=format('clock_timestamp()>=%L::timestamptz AND clock_timestamp()<%L::timestamptz',us,ue);
 read_gate:=format('clock_timestamp()>=%L::timestamptz AND clock_timestamp()<%L::timestamptz',rs,re);
 -- Keep original restrictive guards; narrow them to this immutable one-shot window.
 EXECUTE format('ALTER POLICY closed_setup_guard ON creator_relay_test_private.relay_reservations USING ((%s) OR (%s)) WITH CHECK (%s)',upload_gate,read_gate,upload_gate);
 EXECUTE format('ALTER POLICY closed_setup_guard ON creator_relay_test_private.relay_consumptions USING ((%s) OR (%s)) WITH CHECK (%s)',upload_gate,read_gate,upload_gate);
 EXECUTE format('ALTER POLICY closed_setup_guard ON creator_relay_test_private.relay_readbacks USING (%s) WITH CHECK (%s)',read_gate,read_gate);
 EXECUTE format('CREATE POLICY sealed_issue ON creator_relay_test_private.relay_reservations FOR INSERT TO creator_test_issuer WITH CHECK (%s AND record->>''runId''=%L AND record->>''runAttempt''=''1'' AND record->>''commit''=%L AND expires_at<=%L::timestamptz)',upload_gate,b->'upload'->>'run_id',b->>'commit',ue);
 EXECUTE format('CREATE POLICY sealed_consume_read ON creator_relay_test_private.relay_reservations FOR SELECT TO creator_test_consumer USING (%s)',upload_gate);
 EXECUTE format('CREATE POLICY sealed_consume ON creator_relay_test_private.relay_consumptions FOR INSERT TO creator_test_consumer WITH CHECK (%s)',upload_gate);
 EXECUTE format('CREATE POLICY sealed_verify_read ON creator_relay_test_private.relay_reservations FOR SELECT TO creator_test_verifier USING (%s)',read_gate);
 EXECUTE format('CREATE POLICY sealed_verify_consumption ON creator_relay_test_private.relay_consumptions FOR SELECT TO creator_test_verifier USING (%s)',read_gate);
 EXECUTE format('CREATE POLICY sealed_verify ON creator_relay_test_private.relay_readbacks FOR INSERT TO creator_test_verifier WITH CHECK (%s)',read_gate);
 other_uid:=format('(auth.uid() IS DISTINCT FROM %L::uuid AND auth.uid() IS DISTINCT FROM %L::uuid)',u,v);
 target:='bucket_id=''creator-historical-evidence'' AND name=''relay-tests/creator-auth-flow-v1.json''';
 upload_scope:=format('(auth.uid()=%L::uuid AND %s AND %s)',u,target,upload_gate);
 read_scope:=format('(auth.uid()=%L::uuid AND %s AND %s)',v,target,read_gate);
 EXECUTE format('ALTER POLICY creator_test_closed_subjects ON storage.objects USING (%s OR %s OR %s) WITH CHECK (%s OR %s OR %s)',other_uid,upload_scope,read_scope,other_uid,upload_scope,read_scope);
 -- Command-specific restrictive guards prevent UPDATE/DELETE, including where
 -- pre-existing permissive policies might otherwise authorize them.
 EXECUTE format('CREATE POLICY creator_test_sealed_select_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING (%s OR %s)',other_uid,read_scope);
 EXECUTE format('CREATE POLICY creator_test_sealed_insert_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (%s OR %s)',other_uid,upload_scope);
 EXECUTE format('CREATE POLICY creator_test_sealed_update_guard ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)',other_uid,other_uid);
 EXECUTE format('CREATE POLICY creator_test_sealed_delete_guard ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated USING (%s)',other_uid);
 EXECUTE format('CREATE POLICY creator_test_sealed_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (%s)',upload_scope);
 EXECUTE format('CREATE POLICY creator_test_sealed_select ON storage.objects FOR SELECT TO authenticated USING (%s)',read_scope);
 -- Only this separate approved activation opens bounded connection admission.
 FOREACH item IN ARRAY ARRAY['issuer','consumer','verifier'] LOOP
  EXECUTE format('ALTER ROLE %I CONNECTION LIMIT 1 VALID UNTIL %L','creator_test_'||item||'_login',CASE WHEN item='verifier' THEN re ELSE ue END);
 END LOOP;
 IF clock_timestamp()>=least(us,rs) THEN RAISE EXCEPTION 'WINDOW_STARTED_DURING_TRANSITION'; END IF;
END $$;
COMMIT;
