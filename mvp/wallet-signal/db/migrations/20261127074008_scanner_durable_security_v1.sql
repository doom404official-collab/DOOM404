-- Scanner-only durable security boundary. No historical or Media Agent state is changed.
create schema if not exists scanner_security;
revoke all on schema scanner_security from public, anon, authenticated;
grant usage on schema scanner_security to service_role;
create table scanner_security.policy(route text primary key, rpc_limit integer not null, market_limit integer not null, other_limit integer not null, deadline_seconds integer not null, cache_seconds integer not null default 0, worker boolean not null default false);
create table scanner_security.counters(scope text not null, identity text not null, window_seconds integer not null, bucket bigint not null, used integer not null check(used>=0), primary key(scope,identity,window_seconds,bucket));
create index scanner_counter_expiry on scanner_security.counters(bucket);
create table scanner_security.leases(id uuid primary key, client text not null, request_key text not null unique, route text not null references scanner_security.policy(route), expires_at timestamptz not null, rpc_used integer not null default 0, market_used integer not null default 0, other_used integer not null default 0);
create index scanner_lease_expiry on scanner_security.leases(expires_at);
create index scanner_lease_client on scanner_security.leases(client,expires_at);
create table scanner_security.response_cache(request_key text primary key, body jsonb not null, status integer not null check(status between 200 and 299), expires_at timestamptz not null);
create index scanner_cache_expiry on scanner_security.response_cache(expires_at);
alter table scanner_security.policy enable row level security;
alter table scanner_security.counters enable row level security;
alter table scanner_security.leases enable row level security;
alter table scanner_security.response_cache enable row level security;
revoke all on all tables in schema scanner_security from public,anon,authenticated;
grant select on scanner_security.policy to service_role;
grant select,insert,update,delete on scanner_security.counters,scanner_security.leases,scanner_security.response_cache to service_role;
insert into scanner_security.policy(route,rpc_limit,market_limit,other_limit,deadline_seconds,cache_seconds,worker) values
 ('token-current',4,0,0,12,20,false),('current-creator',6,0,0,12,45,false),('current-liquidity',10,0,4,12,30,false),
 ('creator-evidence',0,0,0,8,30,false),('scoring-evidence',0,0,0,8,20,false),('token-liquidity',0,1,0,12,30,false),
 ('token-extensions',8,0,0,15,30,false),('token-concentration',12,0,0,15,30,false),
 ('creator',40,0,4,30,30,false),('creator-holdings',12,0,0,20,30,false),('wallet',80,0,0,30,30,false),('glitch',100,0,0,30,30,false),('transactions',100,0,0,30,30,false),('history',6,0,0,20,30,false),('live-holder-connections',100,0,0,30,30,false),
 ('holder-frozen-observation',0,0,0,8,30,false),('holder-assessment',0,0,0,10,15,false),('holder-scan-status',0,0,0,8,10,false),
 ('pool-account-evidence',10,0,0,20,0,false),('lp-holder-evidence',30,0,0,25,0,false),('liquidity-transaction-evidence',50,0,0,30,0,false),
 ('holder-scan-start',30,0,0,40,0,true),('holder-scan-tick',30,0,0,55,0,true),('holder-scan-worker',30,0,0,55,0,true),('holder-scan-scheduler',30,0,0,55,0,true),('holder-scan-recovery',30,0,0,55,0,true),('holder-evidence-tick',30,0,0,55,0,true),('holder-network-merge-controlled',10,0,0,30,0,true),('internal/holder-scan-smoke',0,0,0,10,0,true),('liquidity-historical-rpc-probe',6,0,0,30,0,true),('liquidity-archive-state-verify',12,0,0,40,0,true);
-- Caller-controlled ceilings and caller-controlled clocks are intentionally absent.
create function public.scanner_admit_v1(p_client text,p_key text,p_route text,p_id uuid) returns jsonb
language plpgsql security invoker set search_path=pg_catalog as $$
declare t timestamptz; sec bigint; x record; q scanner_security.policy%rowtype; cached scanner_security.response_cache%rowtype; used_now integer; retry integer;
begin
 if p_client is null or p_client !~ '^[a-f0-9]{64}$' or p_key is null or p_key !~ '^[a-f0-9]{64}$' or p_id is null then return jsonb_build_object('status','INVALID');end if;
 select * into q from scanner_security.policy where route=p_route;
 if not found then return jsonb_build_object('status','INVALID');end if;
 perform pg_advisory_xact_lock(404,2701);t:=clock_timestamp();sec:=floor(extract(epoch from t));
 delete from scanner_security.leases where expires_at<=t;
 -- Every admitted request, including cache reads, counts toward abuse limits.
 for x in select * from (values('client',p_client,60,60),('client',p_client,3600,360),('client',p_client,86400,1500),('http','global',60,600),('http','global',86400,20000)) v(s,i,w,lim) loop
  select used into used_now from scanner_security.counters where scope=x.s and identity=x.i and window_seconds=x.w and bucket=sec/x.w;
  if coalesce(used_now,0)>=x.lim then return jsonb_build_object('status','RATE_LIMIT','retryAfter',x.w-(sec%x.w));end if;
 end loop;
 for x in select * from (values('client',p_client,60),('client',p_client,3600),('client',p_client,86400),('http','global',60),('http','global',86400)) v(s,i,w) loop
  insert into scanner_security.counters values(x.s,x.i,x.w,sec/x.w,1) on conflict(scope,identity,window_seconds,bucket) do update set used=scanner_security.counters.used+1;
 end loop;
 if q.cache_seconds>0 then
  select * into cached from scanner_security.response_cache where request_key=p_key and expires_at>t;
  if found then return jsonb_build_object('status','CACHED','body',cached.body,'httpStatus',cached.status);end if;
 end if;
 if exists(select 1 from scanner_security.leases where request_key=p_key) then return jsonb_build_object('status','DUPLICATE','retryAfter',1);end if;
 if (select count(*) from scanner_security.leases)>=24 or (select count(*) from scanner_security.leases where client=p_client)>=8 or q.worker and (select count(*) from scanner_security.leases l join scanner_security.policy p on p.route=l.route where p.worker)>=1 then return jsonb_build_object('status','CONCURRENT_LIMIT','retryAfter',2);end if;
 insert into scanner_security.leases values(p_id,p_client,p_key,p_route,t+make_interval(secs=>q.deadline_seconds+5),0,0,0);
 -- Bound maintenance; no quotas or live leases are reset.
 delete from scanner_security.counters where ctid in(select ctid from scanner_security.counters where bucket*window_seconds<sec-172800 limit 100);
 delete from scanner_security.response_cache where request_key in(select request_key from scanner_security.response_cache where expires_at<t limit 100);
 return jsonb_build_object('status','ADMITTED','lease',p_id,'deadlineMs',q.deadline_seconds*1000);
end; $$;
create function public.scanner_debit_v1(p_id uuid,p_kind text,p_provider text,p_calls integer) returns jsonb
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
  select p_kind s,'global' i,1 w,case p_kind when 'rpc' then 4 when 'market' then 2 else 2 end lim
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
create function public.scanner_finish_v1(p_id uuid,p_body jsonb default null,p_status integer default 200) returns boolean
language plpgsql security invoker set search_path=pg_catalog as $$
declare t timestamptz; l scanner_security.leases%rowtype; ttl integer;
begin
 perform pg_advisory_xact_lock(404,2701);t:=clock_timestamp();
 delete from scanner_security.leases where id=p_id returning * into l;
 if not found then return false;end if;
 select cache_seconds into ttl from scanner_security.policy where route=l.route;
 if p_body is not null and ttl>0 and p_status between 200 and 299 and octet_length(p_body::text)<=262144 and l.expires_at>t then
  insert into scanner_security.response_cache values(l.request_key,p_body,p_status,t+make_interval(secs=>ttl)) on conflict(request_key) do update set body=excluded.body,status=excluded.status,expires_at=excluded.expires_at;
 end if;
 return true;
end; $$;
revoke all on function public.scanner_admit_v1(text,text,text,uuid),public.scanner_debit_v1(uuid,text,text,integer),public.scanner_finish_v1(uuid,jsonb,integer) from public,anon,authenticated;
grant execute on function public.scanner_admit_v1(text,text,text,uuid),public.scanner_debit_v1(uuid,text,text,integer),public.scanner_finish_v1(uuid,jsonb,integer) to service_role;
