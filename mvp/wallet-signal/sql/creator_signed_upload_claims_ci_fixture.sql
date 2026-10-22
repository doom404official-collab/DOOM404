-- Disposable PostgreSQL CI fixture only. Never execute against Supabase.
\set ON_ERROR_STOP on
CREATE ROLE creator_upload_issuer NOLOGIN;
CREATE ROLE creator_unauthorized NOLOGIN;
CREATE SCHEMA creator_private;
REVOKE ALL ON SCHEMA creator_private FROM PUBLIC;
CREATE TABLE creator_private.signed_upload_claims (
 claim_id text PRIMARY KEY,
 approved_commit text NOT NULL,
 object_key text NOT NULL UNIQUE,
 expires_at timestamptz NOT NULL,
 claimed_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT valid_expiry CHECK (expires_at > claimed_at)
);
ALTER TABLE creator_private.signed_upload_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON creator_private.signed_upload_claims FROM PUBLIC;
GRANT USAGE ON SCHEMA creator_private TO creator_upload_issuer;
GRANT INSERT ON creator_private.signed_upload_claims TO creator_upload_issuer;
CREATE POLICY issuer_insert ON creator_private.signed_upload_claims FOR INSERT TO creator_upload_issuer WITH CHECK (expires_at > claimed_at);
GRANT creator_upload_issuer TO postgres;
GRANT creator_unauthorized TO postgres;
-- Assert a first claim succeeds as insert-only role.
SET ROLE creator_upload_issuer;
INSERT INTO creator_private.signed_upload_claims (claim_id,approved_commit,object_key,expires_at) VALUES ('claim-000000000001','commit-a','global/object-a',now()+interval '1 hour') ON CONFLICT DO NOTHING;
-- Repeated claim and cross-commit same object must be no-op.
INSERT INTO creator_private.signed_upload_claims (claim_id,approved_commit,object_key,expires_at) VALUES ('claim-000000000001','commit-a','global/object-a',now()+interval '1 hour') ON CONFLICT DO NOTHING;
INSERT INTO creator_private.signed_upload_claims (claim_id,approved_commit,object_key,expires_at) VALUES ('claim-000000000002','commit-b','global/object-a',now()+interval '1 hour') ON CONFLICT DO NOTHING;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM creator_private.signed_upload_claims) <> 1 THEN RAISE EXCEPTION 'REPLAY_NOT_BLOCKED'; END IF;
END $$;
-- Unauthorized role must have no schema access or DML.
DO $guard$ BEGIN
 IF has_schema_privilege('creator_unauthorized','creator_private','USAGE') OR
    has_table_privilege('creator_unauthorized','creator_private.signed_upload_claims','INSERT') OR
    has_table_privilege('creator_upload_issuer','creator_private.signed_upload_claims','SELECT') OR
    has_table_privilege('creator_upload_issuer','creator_private.signed_upload_claims','UPDATE') OR
    has_table_privilege('creator_upload_issuer','creator_private.signed_upload_claims','DELETE') THEN
   RAISE EXCEPTION 'PRIVILEGE_BOUNDARY_FAILED';
 END IF;
END $guard$;
