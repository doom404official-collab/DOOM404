CREATE TABLE public.glitch_holder_scan_jobs(id uuid PRIMARY KEY,mint text NOT NULL,holder_set_hash text NOT NULL,status text NOT NULL,checkpoint jsonb NOT NULL,summary jsonb NOT NULL,lease_owner uuid,lease_expires_at timestamptz,version bigint NOT NULL,created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL);
CREATE TABLE public.glitch_holder_evidence_validation(job_id uuid REFERENCES public.glitch_holder_scan_jobs(id),signature text,status text,evidence jsonb,attempts integer,checked_at timestamptz,lease_owner uuid,lease_expires_at timestamptz,PRIMARY KEY(job_id,signature));
INSERT INTO public.glitch_holder_scan_jobs SELECT * FROM jsonb_populate_record(NULL::public.glitch_holder_scan_jobs,'{"id":"11111111-1111-4111-8111-111111111111","mint":"77777777777777777777777777777777","holder_set_hash":"disposable-only","status":"partial","checkpoint":{"mint":"77777777777777777777777777777777","snapshot":null,"holders":[],"signatures":{"4444444444444444444444444444444444444444444444444444444444444444444444444444444444444444":"checked","5555555555555555555555555555555555555555555555555555555555555555555555555555555555555555":"checked","6666666666666666666666666666666666666666666666666666666666666666666666666666666666666666":"checked"},"archiveCompletenessProven":false,"networkEvidence":{"version":1,"snapshotIdentity":"{\"mint\":\"77777777777777777777777777777777\",\"snapshot\":null,\"holders\":[]}","processed":{},"transfers":[],"retentionLimited":false}},"summary":{"score":null,"testOnly":true},"lease_owner":null,"lease_expires_at":null,"version":40,"created_at":"2026-10-21T00:00:00+00:00","updated_at":"2026-10-21T00:00:00+00:00"}'::jsonb);
INSERT INTO public.glitch_holder_evidence_validation SELECT * FROM jsonb_populate_record(NULL::public.glitch_holder_evidence_validation,'{"job_id":"11111111-1111-4111-8111-111111111111","signature":"4444444444444444444444444444444444444444444444444444444444444444444444444444444444444444","status":"verified","evidence":{"networkExtraction":{"version":1,"valid":true,"unresolvedTokenTransfers":0,"transfers":[{"signature":"4444444444444444444444444444444444444444444444444444444444444444444444444444444444444444","slot":100,"from":"22222222222222222222222222222222","to":"33333333333333333333333333333333","assetType":"SOL","mint":null,"amountRaw":"1","verifiedOnChain":true,"transferVerified":true},{"signature":"4444444444444444444444444444444444444444444444444444444444444444444444444444444444444444","slot":100,"from":"22222222222222222222222222222222","to":"33333333333333333333333333333333","assetType":"SOL","mint":null,"amountRaw":"2","verifiedOnChain":true,"transferVerified":true},{"signature":"4444444444444444444444444444444444444444444444444444444444444444444444444444444444444444","slot":100,"from":"22222222222222222222222222222222","to":"33333333333333333333333333333333","assetType":"SOL","mint":null,"amountRaw":"3","verifiedOnChain":true,"transferVerified":true},{"signature":"4444444444444444444444444444444444444444444444444444444444444444444444444444444444444444","slot":100,"from":"22222222222222222222222222222222","to":"33333333333333333333333333333333","assetType":"SOL","mint":null,"amountRaw":"4","verifiedOnChain":true,"transferVerified":true},{"signature":"4444444444444444444444444444444444444444444444444444444444444444444444444444444444444444","slot":100,"from":"22222222222222222222222222222222","to":"33333333333333333333333333333333","assetType":"SOL","mint":null,"amountRaw":"5","verifiedOnChain":true,"transferVerified":true},{"signature":"4444444444444444444444444444444444444444444444444444444444444444444444444444444444444444","slot":100,"from":"22222222222222222222222222222222","to":"33333333333333333333333333333333","assetType":"SOL","mint":null,"amountRaw":"6","verifiedOnChain":true,"transferVerified":true},{"signature":"4444444444444444444444444444444444444444444444444444444444444444444444444444444444444444","slot":100,"from":"22222222222222222222222222222222","to":"33333333333333333333333333333333","assetType":"SOL","mint":null,"amountRaw":"7","verifiedOnChain":true,"transferVerified":true}]}},"attempts":1,"checked_at":"2026-10-21T00:00:00+00:00","lease_owner":null,"lease_expires_at":null}'::jsonb);
INSERT INTO public.glitch_holder_evidence_validation SELECT * FROM jsonb_populate_record(NULL::public.glitch_holder_evidence_validation,'{"job_id":"11111111-1111-4111-8111-111111111111","signature":"5555555555555555555555555555555555555555555555555555555555555555555555555555555555555555","status":"verified","evidence":{"networkExtraction":{"version":1,"valid":true,"unresolvedTokenTransfers":0,"transfers":[{"signature":"5555555555555555555555555555555555555555555555555555555555555555555555555555555555555555","slot":100,"from":"22222222222222222222222222222222","to":"33333333333333333333333333333333","assetType":"SOL","mint":null,"amountRaw":"1","verifiedOnChain":true,"transferVerified":true}]}},"attempts":1,"checked_at":"2026-10-21T00:00:00+00:00","lease_owner":null,"lease_expires_at":null}'::jsonb);
INSERT INTO public.glitch_holder_evidence_validation SELECT * FROM jsonb_populate_record(NULL::public.glitch_holder_evidence_validation,'{"job_id":"11111111-1111-4111-8111-111111111111","signature":"6666666666666666666666666666666666666666666666666666666666666666666666666666666666666666","status":"verified","evidence":{"networkExtraction":{"version":1,"valid":true,"unresolvedTokenTransfers":0,"transfers":[{"signature":"6666666666666666666666666666666666666666666666666666666666666666666666666666666666666666","slot":100,"from":"22222222222222222222222222222222","to":"33333333333333333333333333333333","assetType":"SOL","mint":null,"amountRaw":"1","verifiedOnChain":true,"transferVerified":true},{"signature":"6666666666666666666666666666666666666666666666666666666666666666666666666666666666666666","slot":100,"from":"22222222222222222222222222222222","to":"33333333333333333333333333333333","assetType":"SOL","mint":null,"amountRaw":"2","verifiedOnChain":true,"transferVerified":true},{"signature":"6666666666666666666666666666666666666666666666666666666666666666666666666666666666666666","slot":100,"from":"22222222222222222222222222222222","to":"33333333333333333333333333333333","assetType":"SOL","mint":null,"amountRaw":"3","verifiedOnChain":true,"transferVerified":true},{"signature":"6666666666666666666666666666666666666666666666666666666666666666666666666666666666666666","slot":100,"from":"22222222222222222222222222222222","to":"33333333333333333333333333333333","assetType":"SOL","mint":null,"amountRaw":"4","verifiedOnChain":true,"transferVerified":true}]}},"attempts":1,"checked_at":"2026-10-21T00:00:00+00:00","lease_owner":null,"lease_expires_at":null}'::jsonb);
CREATE OR REPLACE FUNCTION public.glitch_claim_holder_scan(p_job_id uuid, p_worker uuid, p_lease_seconds integer DEFAULT 90)
 RETURNS glitch_holder_scan_jobs
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v public.glitch_holder_scan_jobs;
begin
 if p_worker is null or p_lease_seconds not between 15 and 300 then raise exception 'invalid claim parameters'; end if;
 update public.glitch_holder_scan_jobs j
 set lease_owner=p_worker,lease_expires_at=clock_timestamp()+make_interval(secs=>p_lease_seconds),
 status='running',version=j.version+1,updated_at=clock_timestamp()
 where j.id=p_job_id and j.status in ('queued','running','partial')
 and (j.lease_owner is null or j.lease_expires_at<=clock_timestamp())
 returning j.* into v;
 return v;
end $function$;

CREATE OR REPLACE FUNCTION public.glitch_commit_holder_scan(p_job_id uuid, p_worker uuid, p_expected_version bigint, p_checkpoint jsonb, p_summary jsonb, p_status text)
 RETURNS glitch_holder_scan_jobs
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v public.glitch_holder_scan_jobs;
begin
 if p_worker is null or p_checkpoint is null or jsonb_typeof(p_checkpoint)<>'object'
 or p_summary is null or jsonb_typeof(p_summary)<>'object'
 or p_status not in ('running','partial','complete','failed') then raise exception 'invalid commit parameters'; end if;
 update public.glitch_holder_scan_jobs j
 set checkpoint=p_checkpoint,summary=p_summary,status=p_status,version=j.version+1,
 lease_owner=case when p_status='running' then j.lease_owner else null end,
 lease_expires_at=case when p_status='running' then j.lease_expires_at else null end,
 updated_at=clock_timestamp()
 where j.id=p_job_id and j.status='running' and j.lease_owner=p_worker and j.version=p_expected_version
 and j.lease_expires_at>clock_timestamp()
 and p_checkpoint->>'mint'=j.mint
 returning j.* into v;
 return v;
end $function$;

CREATE OR REPLACE FUNCTION public.glitch_finish_holder_evidence(p_job_id uuid, p_signature text, p_worker uuid, p_status text, p_evidence jsonb, p_attempts integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n integer;
begin
 if p_status not in ('verified','rejected','unavailable') or p_attempts<1 then raise exception 'invalid result'; end if;
 update public.glitch_holder_evidence_validation
 set status=p_status,evidence=p_evidence,attempts=p_attempts,checked_at=now(),lease_owner=null,lease_expires_at=null
 where job_id=p_job_id and signature=p_signature and lease_owner=p_worker and lease_expires_at>now();
 get diagnostics n=row_count;
 return n=1;
end $function$;

CREATE OR REPLACE FUNCTION public.glitch_renew_holder_scan(p_job_id uuid, p_worker uuid, p_expected_version bigint, p_lease_seconds integer DEFAULT 90)
 RETURNS glitch_holder_scan_jobs
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v public.glitch_holder_scan_jobs;
begin
 if p_worker is null or p_lease_seconds not between 15 and 300 then raise exception 'invalid renewal parameters'; end if;
 update public.glitch_holder_scan_jobs j
 set lease_expires_at=clock_timestamp()+make_interval(secs=>p_lease_seconds),version=j.version+1,updated_at=clock_timestamp()
 where j.id=p_job_id and j.status='running' and j.lease_owner=p_worker and j.version=p_expected_version
 and j.lease_expires_at>clock_timestamp()
 returning j.* into v;
 return v;
end $function$;


CREATE TABLE test_jobs_baseline AS TABLE public.glitch_holder_scan_jobs;
CREATE TABLE test_evidence_baseline AS TABLE public.glitch_holder_evidence_validation;
