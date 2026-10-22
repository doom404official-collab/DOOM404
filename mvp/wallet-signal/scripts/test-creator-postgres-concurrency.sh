#!/usr/bin/env bash
set -euo pipefail
export PGOPTIONS='-c statement_timeout=15000 -c lock_timeout=10000'
db=(psql -X -h localhost -U postgres -d creator_ci -v ON_ERROR_STOP=1)
"${db[@]}" <<'SQL' &
BEGIN;
SET LOCAL ROLE creator_upload_issuer;
INSERT INTO creator_private.signed_upload_claims(claim_id,approved_commit,object_key,expires_at)
 VALUES ('concurrent-claim-0001','commit-1','global/concurrent-object',now()+interval '1 hour') ON CONFLICT DO NOTHING;
SELECT pg_sleep(3);
COMMIT;
SQL
first=$!
sleep 1
"${db[@]}" <<'SQL' &
SET ROLE creator_upload_issuer;
INSERT INTO creator_private.signed_upload_claims(claim_id,approved_commit,object_key,expires_at)
 VALUES ('concurrent-claim-0002','commit-2','global/concurrent-object',now()+interval '1 hour') ON CONFLICT DO NOTHING;
SQL
second=$!
wait "$first"
wait "$second"
"${db[@]}" <<'SQL'
DO $verify$ BEGIN
 IF (SELECT count(*) FROM creator_private.signed_upload_claims WHERE object_key='global/concurrent-object')<>1
 OR (SELECT approved_commit FROM creator_private.signed_upload_claims WHERE object_key='global/concurrent-object')<>'commit-1'
 THEN RAISE EXCEPTION 'CONCURRENT_REPLAY_ACCEPTED'; END IF;
END $verify$;
SQL
"${db[@]}" <<'SQL' &
BEGIN;
SET LOCAL ROLE creator_upload_issuer;
INSERT INTO creator_private.signed_upload_claims(claim_id,approved_commit,object_key,expires_at)
 VALUES ('rollback-claim-00001','rollback-1','global/rollback-object',now()+interval '1 hour') ON CONFLICT DO NOTHING;
SELECT pg_sleep(3);
ROLLBACK;
SQL
first=$!
sleep 1
"${db[@]}" <<'SQL' &
SET ROLE creator_upload_issuer;
INSERT INTO creator_private.signed_upload_claims(claim_id,approved_commit,object_key,expires_at)
 VALUES ('rollback-claim-00002','rollback-2','global/rollback-object',now()+interval '1 hour') ON CONFLICT DO NOTHING;
SQL
second=$!
wait "$first"
wait "$second"
"${db[@]}" <<'SQL'
DO $verify$ BEGIN
 IF (SELECT count(*) FROM creator_private.signed_upload_claims WHERE object_key='global/rollback-object')<>1
 OR (SELECT approved_commit FROM creator_private.signed_upload_claims WHERE object_key='global/rollback-object')<>'rollback-2'
 THEN RAISE EXCEPTION 'ROLLBACK_RECOVERY_FAILED'; END IF;
END $verify$;
SQL
echo 'POSTGRES_CONCURRENCY_AND_ROLLBACK_VERIFIED'
