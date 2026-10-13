-- DOOM404 Intelligence Vault v0: PostgreSQL migration (not applied).
-- Public on-chain evidence only; no API keys, personal identities, or provider raw payload dumps.
create table if not exists token_creator_attributions (
  mint text primary key,
  indexed_creator text,
  verified_creator text,
  status text not null check (status in ('INDEXED_UNVERIFIED','ONCHAIN_MATCH_PENDING_INDEPENDENT_REVIEW','VERIFIED','UNRESOLVED','CONFLICT')),
  creation_signature text,
  creation_timestamp timestamptz,
  program_id text,
  decoder_version text,
  verification_method text,
  last_checked_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists token_creator_attributions_creator_idx on token_creator_attributions(indexed_creator);
create table if not exists onchain_transaction_evidence (
  signature text primary key,
  mint text not null,
  block_time timestamptz,
  program_id text,
  decoded_creator text,
  fee_payer text,
  creator_is_signer boolean,
  decoder_version text,
  instruction_hash text,
  verification_status text not null check (verification_status in ('CANDIDATE','DECODED_MATCH','VERIFIED','REJECTED')),
  observed_at timestamptz not null default now()
);
create index if not exists onchain_transaction_evidence_mint_idx on onchain_transaction_evidence(mint);
create table if not exists creator_investigation_checkpoints (
  mint text primary key,
  indexed_creator text not null,
  created_timestamp bigint not null,
  checkpoint_version integer not null default 1,
  checkpoint jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists intelligence_source_observations (
  id bigint generated always as identity primary key,
  subject_type text not null,
  subject_id text not null,
  source_name text not null,
  field_name text not null,
  value_hash text,
  observed_at timestamptz not null default now(),
  expires_at timestamptz
);
create index if not exists intelligence_source_subject_idx on intelligence_source_observations(subject_type,subject_id,observed_at desc);
-- RLS/permissions must be configured before deployment. All tables remain private.
