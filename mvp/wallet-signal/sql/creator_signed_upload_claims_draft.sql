-- CI-07 DESIGN MIGRATION ONLY. Do not apply until separate database change review.
-- Atomic, durable, one-shot issuance claims. No public Data API exposure.
create schema if not exists creator_private;
revoke all on schema creator_private from public, anon, authenticated;
create table if not exists creator_private.signed_upload_claims (
 claim_id text primary key,
 approved_commit text not null,
 object_key text not null,
 expires_at timestamptz not null,
 claimed_at timestamptz not null default now(),
 constraint signed_upload_claims_claim_id_nonempty check (length(claim_id) between 16 and 256)
);
alter table creator_private.signed_upload_claims enable row level security;
revoke all on creator_private.signed_upload_claims from public, anon, authenticated;
-- Issuer must atomically INSERT with ON CONFLICT DO NOTHING and require exactly one row returned.
-- Claims are never automatically deleted on expiry: replay remains blocked across restarts.
-- No SECURITY DEFINER function and no client-side table access.
