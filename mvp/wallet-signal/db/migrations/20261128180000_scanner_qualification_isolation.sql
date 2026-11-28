-- Private, append-only qualification snapshots. Production evidence is untouched.
create table public.scanner_qualification_observations(
 run_id text not null check(run_id ~ '^[0-9]+-[0-9]+$'),
 candidate_sha text not null check(candidate_sha ~ '^[a-f0-9]{40}$'),
 mint text not null check(mint ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
 phase text not null check(phase in ('cold','warm')),
 observation jsonb not null check(observation->>'mint'=mint and observation->>'status'='investigation_completed'),
 metrics jsonb not null,
 captured_at timestamptz not null default clock_timestamp(),
 primary key(run_id,candidate_sha,mint,phase)
);
alter table public.scanner_qualification_observations enable row level security;
revoke all on public.scanner_qualification_observations from public,anon,authenticated,service_role;
grant select,insert on public.scanner_qualification_observations to service_role;
comment on table public.scanner_qualification_observations is 'Private append-only backend qualification observations; not production cache, not proof of full application qualification.';
