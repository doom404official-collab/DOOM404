-- Proposed holder scan migration. Apply only after review.
create table if not exists public.glitch_holder_scan_jobs (
 id uuid primary key default gen_random_uuid(),
 mint text not null check (length(mint) between 32 and 44),
 holder_set_hash text not null,
 status text not null default 'queued' check (status in ('queued','running','partial','complete','failed')),
 checkpoint jsonb not null,
 summary jsonb not null default '{}'::jsonb,
 lease_owner uuid,
 lease_expires_at timestamptz,
 version bigint not null default 0,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(mint,holder_set_hash)
);
create index if not exists glitch_holder_jobs_pending on public.glitch_holder_scan_jobs(status,lease_expires_at,updated_at);
alter table public.glitch_holder_scan_jobs enable row level security;
revoke all on public.glitch_holder_scan_jobs from anon,authenticated;
-- No public policies; service-role backend only.
-- Claim/renew/commit RPC functions must be added with strict authorization,
-- expiring leases and optimistic version checks before worker activation.
