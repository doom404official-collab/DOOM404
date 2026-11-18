-- UNAPPLIED differential closeout; no DROP/DELETE/password reset or session kill.
BEGIN;
SELECT pg_advisory_xact_lock(404,608);
DO $$
DECLARE b jsonb; u uuid; v uuid; item text; deny text;
BEGIN
 IF to_regclass('creator_relay_test_private.sealed_test_window') IS NULL THEN RAISE EXCEPTION 'NO_SEALED_WINDOW_USE_CLOSED_SETUP_CLOSEOUT'; END IF;
 SELECT binding INTO STRICT b FROM creator_relay_test_private.sealed_test_window WHERE singleton;
 u:=(b->>'uploadUid')::uuid;v:=(b->>'readUid')::uuid;
 IF u IS NULL OR v IS NULL OR u=v THEN RAISE EXCEPTION 'INVALID_RETAINED_BINDING'; END IF;
 deny:=format('(auth.uid() IS DISTINCT FROM %L::uuid AND auth.uid() IS DISTINCT FROM %L::uuid)',u,v);
 EXECUTE format('ALTER POLICY creator_test_closed_subjects ON storage.objects USING (%s) WITH CHECK (%s)',deny,deny);
 FOREACH item IN ARRAY ARRAY['relay_reservations','relay_consumptions','relay_readbacks'] LOOP
  EXECUTE format('ALTER POLICY closed_setup_guard ON creator_relay_test_private.%I USING(false) WITH CHECK(false)',item);
 END LOOP;
 FOREACH item IN ARRAY ARRAY['issuer','consumer','verifier'] LOOP
  EXECUTE format('ALTER ROLE %I NOLOGIN CONNECTION LIMIT 0','creator_test_'||item||'_login');
  EXECUTE format('REVOKE %I FROM %I','creator_test_'||item,'creator_test_'||item||'_login');
 END LOOP;
 UPDATE creator_relay_test_private.sealed_test_window SET closed_at=coalesce(closed_at,clock_timestamp()) WHERE singleton;
END $$;
COMMIT;
-- Existing in-flight writes can finish after closure; reconcile independently.
-- The immutable binding and claim rows remain. Reapplying a transition is rejected.
