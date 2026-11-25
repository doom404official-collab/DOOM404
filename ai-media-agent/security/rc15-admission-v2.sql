-- RC-15: preserve grants and invoker permissions; no quota reset.
create or replace function public.ai_media_v16_preview_admit_v2(p_purpose text,p_digest text,p_nonce uuid,p_issued_ms bigint,p_expiry_ms bigint)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare now_at timestamptz:=clock_timestamp(); bucket_at timestamptz; n integer; global_used integer; client_used integer;
begin
 if p_purpose is null or p_digest is null or p_purpose not in ('research','narration','permit') or p_digest !~ '^[a-f0-9]{64}$' or p_nonce is null then return jsonb_build_object('status','INVALID');end if;
 perform pg_advisory_xact_lock(hashtextextended('doom404-media-v16-preview-'||p_purpose,0));
 -- Sample the clock after lock acquisition so waiting requests use the current bucket.
 now_at:=clock_timestamp();bucket_at:=date_trunc('hour',now_at,'UTC');
 if p_purpose='research' and (p_issued_ms is null or p_expiry_ms is null or p_expiry_ms-p_issued_ms<>300000 or p_issued_ms>floor(extract(epoch from now_at)*1000)+15000 or p_expiry_ms<=floor(extract(epoch from now_at)*1000)) then return jsonb_build_object('status','EXPIRED');end if;
 delete from public.ai_media_v16_preview_nonces where purpose=p_purpose and expires_at<now_at;
 delete from public.ai_media_v16_preview_quota where purpose=p_purpose and bucket<now_at-interval '2 days';
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

revoke all on function public.ai_media_v16_preview_admit_v2(text,text,uuid,bigint,bigint) from public,anon,authenticated;
grant execute on function public.ai_media_v16_preview_admit_v2(text,text,uuid,bigint,bigint) to service_role;
-- Superseded preview code cannot admit unsigned research through the legacy RPC.
create or replace function public.ai_media_v16_preview_admit(p_purpose text,p_digest text,p_nonce uuid)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 if p_purpose is distinct from 'narration' then return jsonb_build_object('status','INVALID');end if;
 return public.ai_media_v16_preview_admit_v2(p_purpose,p_digest,p_nonce,null,null);
end $$;
