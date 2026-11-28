-- Independent post-scan reference data; never read by the production engine.
create table public.scanner_qualification_references(
 run_id text not null check(run_id ~ '^[0-9]+-[0-9]+$'),
 candidate_sha text not null check(candidate_sha ~ '^[a-f0-9]{40}$'),
 mint text not null check(mint ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
 source_provider text not null check(source_provider='helius'),
 reference_status text not null check(reference_status in ('captured_unreviewed','retrieval_unavailable')),
 reference jsonb not null, metrics jsonb not null,
 captured_at timestamptz not null default clock_timestamp(),
 primary key(run_id,candidate_sha,mint)
);
alter table public.scanner_qualification_references enable row level security;
revoke all on public.scanner_qualification_references from public,anon,authenticated,service_role;
grant select,insert on public.scanner_qualification_references to service_role;
