create table scanner_security.release_approvals (
 commit_sha text not null check(commit_sha~'^[a-f0-9]{40}$'),
 deployment_id text not null check(deployment_id~'^dpl_[a-zA-Z0-9]{10,100}$'),
 project_id text not null check(project_id='prj_AbsbiTw8Kc8axGpZ3FFpH9VvDS4e'),
 branch text not null check(branch='integration/glitch-app-main-20261118'),
 authorized_by text not null check(authorized_by='doom404official-collab'),
 security_run_id bigint not null check(security_run_id>0), regression_run_id bigint not null check(regression_run_id>0),
 reviewed_run_id bigint not null check(reviewed_run_id>0), approved boolean not null default false,
 authorized_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null,
 primary key(commit_sha,deployment_id),check(expires_at>authorized_at)
);
alter table scanner_security.release_approvals enable row level security;
revoke all on scanner_security.release_approvals from public,anon,authenticated,service_role;
grant select on scanner_security.release_approvals to service_role;
-- Only the database owner may record the explicit owner release authorization.
-- The app's service key, GitHub provider keys and Vercel deployment access cannot grant it.
create function public.scanner_admit_v2(p_client text,p_key text,p_route text,p_id uuid,p_environment text,p_sha text,p_deployment text) returns jsonb
language plpgsql security invoker set search_path=pg_catalog as $$
begin
 if p_environment is null or p_environment not in ('preview','production') or p_sha is null or p_sha!~'^[a-f0-9]{40}$' or p_deployment is null or p_deployment!~'^dpl_[a-zA-Z0-9]{10,100}$' then return jsonb_build_object('status','INVALID');end if;
 if p_environment='production' and not exists(select 1 from scanner_security.release_approvals where commit_sha=p_sha and deployment_id=p_deployment and approved and expires_at>clock_timestamp()) then return jsonb_build_object('status','RELEASE_NOT_AUTHORIZED');end if;
 return public.scanner_admit_v1(p_client,p_key,p_route,p_id);
end;$$;
revoke all on function public.scanner_admit_v2(text,text,text,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.scanner_admit_v2(text,text,text,uuid,text,text,text) to service_role;
