-- CI-07 DESIGN MIGRATION ONLY. Do not apply until separate database change review.
-- Atomic, durable, one-shot issuance claims. No public Data API exposure.
create schema if not exists creator_private;
revoke all on schema creator_private from public, anon, authenticated;
create table if not exists creator_private.signed_upload_claims (
 claim_id text primary key,
 approved_commit text not null,
 object_key text not null unique,
 expires_at timestamptz not null,
 claimed_at timestamptz not null default now(),
 constraint signed_upload_claims_claim_id_nonempty check (length(claim_id) between 16 and 256)
);
alter table creator_private.signed_upload_claims enable row level security;
-- The dedicated issuer role must be provisioned and audited separately.
-- Do not grant table access to service_role or PUBLIC as a shortcut.
-- Explicitly prohibit claim expiration before creation.
alter table creator_private.signed_upload_claims add constraint signed_upload_claims_expiry_after_claim check (expires_at > claimed_at);
revoke all on creator_private.signed_upload_claims from public, anon, authenticated;
-- Issuer must atomically INSERT with ON CONFLICT DO NOTHING and require affected-row count = 1.
-- PostgreSQL RETURNING requires SELECT privilege on returned columns; avoid RETURNING
-- in the insert-only role design unless an explicitly scoped SELECT grant is reviewed.
-- Claims are never automatically deleted on expiry: replay remains blocked across restarts.
-- UNIQUE(object_key) prevents reissuing the same evidence object under a different commit or claim ID.
-- No SECURITY DEFINER function and no client-side table access.

-- Proposed issuer SQL: INSERT ... ON CONFLICT (claim_id) DO NOTHING;
-- Trusted issuer checks driver rowCount = 1 (first claim) or 0 (duplicate).
-- A successful claim requires affected-row count = 1; no DELETE/UPDATE grants to issuer.
-- RLS on private schema is defense-in-depth; role privilege review is mandatory.

-- SECURITY REVIEW NOTE: RLS is enabled without an issuer INSERT policy.
-- This is intentionally NOT deployable as a working issuer schema yet.
-- Prior to migration approval: provision a dedicated NOLOGIN issuer database role,
-- explicitly grant schema USAGE and table INSERT only, and add an INSERT policy
-- scoped TO that role. Do not grant UPDATE, DELETE, or unrestricted SELECT.
-- Define how the trusted server assumes that role; service_role bypasses RLS
-- and therefore cannot demonstrate least-privilege authorization.
-- Verify duplicate INSERT behavior and privilege denials using a controlled
-- integration test, not merely an in-memory concurrency simulation.

-- PROPOSED LEAST-PRIVILEGE ROLE AND POLICY (still draft; do not execute):
-- CREATE ROLE creator_upload_issuer NOLOGIN;
-- GRANT USAGE ON SCHEMA creator_private TO creator_upload_issuer;
-- GRANT INSERT ON creator_private.signed_upload_claims TO creator_upload_issuer;
-- CREATE POLICY creator_upload_issuer_insert ON creator_private.signed_upload_claims
--   FOR INSERT TO creator_upload_issuer WITH CHECK (expires_at > claimed_at);
-- An authenticated server role-assumption path is not designed yet; do not
-- grant creator_upload_issuer to anon, authenticated or service_role.
-- Validate RLS and role permissions with SET ROLE in an isolated test database.
