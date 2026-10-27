-- UNAPPLIED non-destructive closeout candidate, parent only after state review.
-- Does NOT terminate sessions, undo dispatched writes or delete evidence/roles.
BEGIN;
ALTER ROLE creator_test_issuer_login NOLOGIN CONNECTION LIMIT 0;
ALTER ROLE creator_test_consumer_login NOLOGIN CONNECTION LIMIT 0;
ALTER ROLE creator_test_verifier_login NOLOGIN CONNECTION LIMIT 0;
REVOKE creator_test_issuer FROM creator_test_issuer_login;
REVOKE creator_test_consumer FROM creator_test_consumer_login;
REVOKE creator_test_verifier FROM creator_test_verifier_login;
ALTER POLICY closed_setup_guard ON creator_relay_test_private.relay_reservations USING(false) WITH CHECK(false);
ALTER POLICY closed_setup_guard ON creator_relay_test_private.relay_consumptions USING(false) WITH CHECK(false);
ALTER POLICY closed_setup_guard ON creator_relay_test_private.relay_readbacks USING(false) WITH CHECK(false);
COMMIT;
-- Keep the Storage deny-subject guard. Removing it can restore permissive access.
-- Explicit session/credential revocation and read-only reconciliation remain needed
-- if access was ever enabled. Data/schema/identity deletion needs separate review.
