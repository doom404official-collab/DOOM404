-- NOT APPLIED: hosted provider confirmation expired. Durable enforcement is not enabled.
-- Dedicated media-agent preview admission state. No existing tables are changed.
create table public.ai_media_v16_preview_quota (
 purpose text not null check (purpose in ('research','narration')),
 digest text not null,
 bucket timestamptz not null,
 used integer not null check (used > 0),
 primary key (purpose,digest,bucket)
);
create table public.ai_media_v16_preview_nonces (
 purpose text not null check (purpose in ('research','narration')),
 nonce uuid not null,
 expires_at timestamptz not null,
 primary key (purpose,nonce)
);
create index ai_media_v16_nonce_expiry on public.ai_media_v16_preview_nonces(expires_at);
alter table public.ai_media_v16_preview_quota enable row level security;
alter table public.ai_media_v16_preview_nonces enable row level security;
revoke all on public.ai_media_v16_preview_quota,public.ai_media_v16_preview_nonces from public,anon,authenticated;
grant select,insert,update,delete on public.ai_media_v16_preview_quota,public.ai_media_v16_preview_nonces to service_role;
create policy media_preview_service_only on public.ai_media_v16_preview_quota to service_role using (true) with check (true);
create policy media_preview_nonce_service_only on public.ai_media_v16_preview_nonces to service_role using (true) with check (true);
create function public.ai_media_v16_preview_admit(p_purpose text,p_digest text,p_nonce uuid)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare now_at timestamptz:=clock_timestamp(); bucket_at timestamptz:=date_trunc('hour',now_at); n integer; global_used integer; client_used integer;
begin
 if p_purpose not in ('research','narration') or p_digest !~ '^[a-f0-9]{64}$' or p_nonce is null then return jsonb_build_object('status','INVALID');end if;
 perform pg_advisory_xact_lock(hashtextextended('doom404-media-v16-preview-'||p_purpose,0));
 delete from public.ai_media_v16_preview_nonces where expires_at<now_at;
 delete from public.ai_media_v16_preview_quota where bucket<now_at-interval '2 days';
 insert into public.ai_media_v16_preview_nonces values(p_purpose,p_nonce,now_at+interval '2 hours') on conflict do nothing;
 get diagnostics n=row_count;
 if n=0 then return jsonb_build_object('status','REPLAY');end if;
 select used into global_used from public.ai_media_v16_preview_quota where purpose=p_purpose and digest='global' and bucket=bucket_at;
 select used into client_used from public.ai_media_v16_preview_quota where purpose=p_purpose and digest=p_digest and bucket=bucket_at;
 if coalesce(global_used,0)>=30 or coalesce(client_used,0)>=6 then return jsonb_build_object('status','RATE_LIMIT');end if;
 insert into public.ai_media_v16_preview_quota values(p_purpose,'global',bucket_at,1),(p_purpose,p_digest,bucket_at,1)
 on conflict(purpose,digest,bucket) do update set used=ai_media_v16_preview_quota.used+1;
 return jsonb_build_object('status','ADMITTED');
end $$;
revoke all on function public.ai_media_v16_preview_admit(text,text,uuid) from public,anon,authenticated;
grant execute on function public.ai_media_v16_preview_admit(text,text,uuid) to service_role;
