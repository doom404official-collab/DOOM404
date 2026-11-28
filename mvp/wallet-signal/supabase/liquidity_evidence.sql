-- Apply only after review in the correct Supabase project.
-- Private service-role storage; never expose this table to anonymous clients.
create table if not exists public.liquidity_evidence_checkpoints (
  mint text primary key check (mint ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  schema_version integer not null default 1,
  status text not null check (status in ('partial','account_checks_completed')),
  observed_at timestamptz not null,
  reported_pool_count integer check (reported_pool_count >= 0),
  checked_pool_count integer not null default 0 check (checked_pool_count >= 0),
  evidence jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.liquidity_evidence_checkpoints enable row level security;
revoke all on public.liquidity_evidence_checkpoints from anon, authenticated;
create index if not exists liquidity_evidence_checkpoints_updated_idx
  on public.liquidity_evidence_checkpoints (updated_at desc);
comment on table public.liquidity_evidence_checkpoints is
  'Conservative pool-account evidence only; no verified reserves, LP safety, or final liquidity score.';
