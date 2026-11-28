-- Append-only facts, separated from dynamic snapshots and isolated test namespaces.
create table public.scanner_creator_evidence(
 namespace text not null check(namespace='runtime' or namespace ~ '^qualification:[0-9]+-[0-9]+$'),
 mint text not null check(mint ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
 creator text not null check(creator ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
 signature text not null, instruction_id text not null, evidence_type text not null,
 decoder_version text not null, amount_raw numeric(20,0) not null check(amount_raw>=0 and amount_raw<=18446744073709551615),
 slot bigint not null check(slot>=0), source_provider text not null,
 observed_at timestamptz not null, attribution_basis text not null,
 verification_status text not null, evidence jsonb not null,
 retained_at timestamptz not null default clock_timestamp(),
 primary key(namespace,mint,creator,signature,instruction_id,evidence_type,decoder_version,amount_raw)
);
alter table public.scanner_creator_evidence enable row level security;
revoke all on public.scanner_creator_evidence from public,anon,authenticated,service_role;
grant select,insert on public.scanner_creator_evidence to service_role;
create function public.scanner_retain_creator_evidence_v1(p_namespace text,p_observation jsonb) returns integer
language plpgsql security invoker set search_path=pg_catalog as $$
declare e jsonb; p jsonb; n integer; total integer:=0;
begin
 if p_namespace is null or not(p_namespace='runtime' or p_namespace ~ '^qualification:[0-9]+-[0-9]+$') then raise exception 'INVALID_EVIDENCE_NAMESPACE';end if;
 if p_observation->>'status' is distinct from 'investigation_completed' or jsonb_typeof(p_observation->'creator'->'events') is distinct from 'array' then return 0;end if;
 for e in select value from jsonb_array_elements(p_observation->'creator'->'events') loop
  p:=e->'evidenceProvenance';
  -- Legacy events remain in their original snapshot; never invent missing provenance.
  if e->>'independentlyVerified' is distinct from 'true' or e->>'instructionVerified' is distinct from 'true' or p is null then continue;end if;
  if e->>'mint' is distinct from p_observation->>'mint' or e->>'creator' is distinct from p_observation->'creator'->>'creator' or p->>'mint' is distinct from e->>'mint' or p->>'transactionSignature' is distinct from e->>'signature' or p->>'amountRaw' is distinct from e->>'amountRaw' then raise exception 'EVIDENCE_IDENTITY_MISMATCH';end if;
  if p->>'slot' !~ '^[0-9]+$' or e->>'amountRaw' !~ '^(0|[1-9][0-9]*)$' or coalesce(p->>'decoderVersion','')='' or coalesce(p->>'sourceProvider','')='' or coalesce(p->>'attributionBasis','')='' or coalesce(p->>'instructionIdentifier','')='' or coalesce(p->>'observedAt','')='' then continue;end if;
  insert into public.scanner_creator_evidence(namespace,mint,creator,signature,instruction_id,evidence_type,decoder_version,amount_raw,slot,source_provider,observed_at,attribution_basis,verification_status,evidence)
  values(p_namespace,e->>'mint',e->>'creator',e->>'signature',p->>'instructionIdentifier',e->>'type',p->>'decoderVersion',(e->>'amountRaw')::numeric,(p->>'slot')::bigint,p->>'sourceProvider',(p->>'observedAt')::timestamptz,p->>'attributionBasis',e->>'verificationStatus',e)
  on conflict do nothing;
  get diagnostics n=row_count;total:=total+n;
 end loop;
 return total;
end; $$;
revoke all on function public.scanner_retain_creator_evidence_v1(text,jsonb) from public,anon,authenticated;
grant execute on function public.scanner_retain_creator_evidence_v1(text,jsonb) to service_role;
-- Same CAS lease/size contract; archive and snapshot commit atomically.
create or replace function public.scanner_finish_investigation_v1(p_mint text,p_owner uuid,p_observation jsonb) returns boolean
language plpgsql security invoker set search_path=pg_catalog as $$
declare t timestamptz:=clock_timestamp(); n integer;
begin
 if p_observation is null or p_observation->>'mint' is distinct from p_mint or p_observation->>'status' is distinct from 'investigation_completed' or octet_length(p_observation::text)>262144 then return false;end if;
 update public.scanner_token_investigations set status='complete',observation=p_observation,lease_owner=null,lease_until=null,updated_at=t,
 expires_at=t+case when p_observation->'adaptiveCreator'->>'paginationRemaining'='true' then interval '15 seconds' else interval '1 hour' end
 where mint=p_mint and status='running' and lease_owner=p_owner and lease_until>t;
 get diagnostics n=row_count;
 if n=1 then perform public.scanner_retain_creator_evidence_v1('runtime',p_observation);end if;
 return n=1;
end; $$;
-- An isolated scan's automatic write tests the same archive producer without
-- polluting runtime evidence. No production token history is read or modified.
create function public.scanner_archive_qualification_v1() returns trigger
language plpgsql security invoker set search_path=pg_catalog as $$
begin perform public.scanner_retain_creator_evidence_v1('qualification:'||new.run_id,new.observation);return new;end; $$;
revoke all on function public.scanner_archive_qualification_v1() from public,anon,authenticated;
grant execute on function public.scanner_archive_qualification_v1() to service_role;
create trigger scanner_qualification_archive after insert on public.scanner_qualification_observations for each row execute function public.scanner_archive_qualification_v1();
