-- Permit the existing four-quote parallel path within the unchanged minute/day budget.
create or replace function public.scanner_debit_v1(p_id uuid,p_kind text,p_provider text,p_calls integer) returns jsonb
language plpgsql security invoker set search_path=pg_catalog as $$
declare t timestamptz; sec bigint; l scanner_security.leases%rowtype; q scanner_security.policy%rowtype; x record; used_now integer; cap integer; already integer;
begin
 if p_id is null or p_kind is null or p_provider is null or p_kind not in ('rpc','market','other') or p_provider not in ('alchemy','helius','configured_rpc','market','other') or p_calls is null or p_calls<1 or p_calls>100 then return jsonb_build_object('status','INVALID');end if;
 perform pg_advisory_xact_lock(404,2701);t:=clock_timestamp();sec:=floor(extract(epoch from t));
 select * into l from scanner_security.leases where id=p_id and expires_at>t;
 if not found then return jsonb_build_object('status','LEASE_EXPIRED');end if;
 select * into q from scanner_security.policy where route=l.route;
 cap:=case p_kind when 'rpc' then q.rpc_limit when 'market' then q.market_limit else q.other_limit end;
 already:=case p_kind when 'rpc' then l.rpc_used when 'market' then l.market_used else l.other_used end;
 if already+p_calls>cap then return jsonb_build_object('status','REQUEST_BUDGET','retryAfter',60);end if;
 -- Shared aggregate caps span every serverless instance and preview/production deployment.
 for x in select * from (
  select p_kind s,'global' i,1 w,case p_kind when 'rpc' then 4 when 'market' then 2 else 4 end lim
  union all select p_kind,'global',60,case p_kind when 'rpc' then 120 when 'market' then 60 else 30 end
  union all select p_kind,'global',3600,case p_kind when 'rpc' then 1800 when 'market' then 500 else 120 end
  union all select p_kind,'global',86400,case p_kind when 'rpc' then 6000 when 'market' then 1500 else 500 end
  union all select 'provider',p_provider,60,case p_provider when 'helius' then 30 else 120 end where p_kind='rpc'
  union all select 'provider',p_provider,86400,case p_provider when 'helius' then 1000 else 6000 end where p_kind='rpc'
 ) v loop
  select used into used_now from scanner_security.counters where scope=x.s and identity=x.i and window_seconds=x.w and bucket=sec/x.w;
  if coalesce(used_now,0)+(case when x.w=1 then 1 else p_calls end)>x.lim then return jsonb_build_object('status','PROVIDER_BUDGET','retryAfter',x.w-(sec%x.w));end if;
 end loop;
 for x in select * from (
  select p_kind s,'global' i,unnest(array[1,60,3600,86400]) w
  union all select 'provider',p_provider,unnest(array[60,86400]) where p_kind='rpc'
 ) v loop
  insert into scanner_security.counters values(x.s,x.i,x.w,sec/x.w,case when x.w=1 then 1 else p_calls end) on conflict(scope,identity,window_seconds,bucket) do update set used=scanner_security.counters.used+excluded.used;
 end loop;
 update scanner_security.leases set rpc_used=rpc_used+case when p_kind='rpc' then p_calls else 0 end, market_used=market_used+case when p_kind='market' then p_calls else 0 end,other_used=other_used+case when p_kind='other' then p_calls else 0 end where id=p_id;
 return jsonb_build_object('status','ADMITTED');
end; $$;
