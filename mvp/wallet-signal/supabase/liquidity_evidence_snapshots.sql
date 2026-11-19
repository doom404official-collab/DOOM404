-- Append-only historical snapshots; never overwrite previous observations.
create table if not exists public.liquidity_evidence_snapshots (
  id bigint generated always as identity primary key,
  mint text not null check (mint ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  observed_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  status text not null check (status in ('partial','account_checks_completed')),
  evidence jsonb not null
);
create index if not exists liquidity_snapshots_mint_time_idx
 on public.liquidity_evidence_snapshots(mint, observed_at desc);
alter table public.liquidity_evidence_snapshots enable row level security;
revoke all on public.liquidity_evidence_snapshots from anon, authenticated;
comment on table public.liquidity_evidence_snapshots is 'Historical pool evidence; snapshots are not verified liquidity safety scores.';
