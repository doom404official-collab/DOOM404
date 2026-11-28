-- Proposed schema ONLY. Do not apply without approval.
-- Public scans must never expose provider credentials or raw internal checkpoint JSON.
create table if not exists public.glitch_holder_scan_jobs (
 id uuid primary key default gen_random_uuid(),
 mint text not null check (length(mint) between 32 and 44),
 status text not null check (status in ('queued','running','partial','complete','failed')),
 snapshot_slot bigint,
 holder_set_hash text not null,
 checkpoint jsonb not null,
 summary jsonb not null default '{}'::jsonb,
 lease_owner uuid,
 lease_expires_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists glitch_holder_scan_jobs_mint_updated
 on public.glitch_holder_scan_jobs (mint,updated_at desc);
alter table public.glitch_holder_scan_jobs enable row level security;
-- No anonymous access policies. Server-side service role access only.
-- Enforce worker leases and atomic compare-and-swap updates in a later reviewed migration.
