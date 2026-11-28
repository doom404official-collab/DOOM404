-- Bounded fresh-token observations are isolated from accepted historical checkpoints.
create table public.scanner_token_investigations(
 mint text primary key check(mint ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
 status text not null check(status in ('running','complete')),
 lease_owner uuid, lease_until timestamptz, observation jsonb,
 updated_at timestamptz not null default clock_timestamp(), expires_at timestamptz not null,
 check((status='running' and lease_owner is not null and lease_until is not null) or (status='complete' and lease_owner is null and lease_until is null))
);
alter table public.scanner_token_investigations enable row level security;
revoke all on public.scanner_token_investigations from public,anon,authenticated;
grant select,insert,update on public.scanner_token_investigations to service_role;
create function public.scanner_claim_investigation_v1(p_mint text,p_owner uuid) returns jsonb
language plpgsql security invoker set search_path=pg_catalog as $$
declare t timestamptz:=clock_timestamp(); r public.scanner_token_investigations%rowtype;
begin
 if p_mint is null or p_mint !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' or p_owner is null then return jsonb_build_object('status','invalid');end if;
 -- Same-mint calls serialize; unrelated historical jobs are never touched.
 perform pg_advisory_xact_lock(hashtextextended('scanner-intelligence:'||p_mint,0));
 select * into r from public.scanner_token_investigations where mint=p_mint;
 if found and r.status='complete' and r.expires_at>t then return jsonb_build_object('status','cached','observation',r.observation);end if;
 if found and r.status='running' and r.lease_until>t then return jsonb_build_object('status','assessment_in_progress');end if;
 insert into public.scanner_token_investigations(mint,status,lease_owner,lease_until,expires_at)
 values(p_mint,'running',p_owner,t+interval '50 seconds',t+interval '50 seconds')
 on conflict(mint) do update set status='running',lease_owner=p_owner,lease_until=t+interval '50 seconds',expires_at=t+interval '50 seconds',updated_at=t;
 return jsonb_build_object('status','claimed');
end; $$;
create function public.scanner_finish_investigation_v1(p_mint text,p_owner uuid,p_observation jsonb) returns boolean
language plpgsql security invoker set search_path=pg_catalog as $$
declare t timestamptz:=clock_timestamp(); n integer;
begin
 if p_observation is null or p_observation->>'mint' is distinct from p_mint or p_observation->>'status' is distinct from 'investigation_completed' or octet_length(p_observation::text)>262144 then return false;end if;
 update public.scanner_token_investigations set status='complete',observation=p_observation,lease_owner=null,lease_until=null,updated_at=t,expires_at=t+interval '1 hour'
 where mint=p_mint and status='running' and lease_owner=p_owner and lease_until>t;
 get diagnostics n=row_count;return n=1;
end; $$;
revoke all on function public.scanner_claim_investigation_v1(text,uuid),public.scanner_finish_investigation_v1(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.scanner_claim_investigation_v1(text,uuid),public.scanner_finish_investigation_v1(text,uuid,jsonb) to service_role;
-- Existing global/client/provider budgets and single-worker concurrency remain enforced.
insert into scanner_security.policy(route,rpc_limit,market_limit,other_limit,deadline_seconds,cache_seconds,worker)
 values('token-investigation',18,0,0,40,15,true);
