-- DISPOSABLE SYNTHETIC MODEL ONLY. Reconstructed from parent catalog evidence
-- supplied 2026-10-27, not a byte-for-byte hosted pg_get_functiondef export.
-- Non-lease column nullability/defaults below are fixture assumptions; do not
-- use their behavior as proof of unreported hosted constraints.
CREATE TABLE public.creator_intelligence_jobs(
 mint text PRIMARY KEY,status text NOT NULL DEFAULT 'queued',stage text NOT NULL DEFAULT 'identification',
 state jsonb NOT NULL DEFAULT '{}'::jsonb,request_count_total bigint NOT NULL DEFAULT 0 CHECK(request_count_total>=0),
 lease_owner text,lease_until timestamptz,last_error text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.creator_intelligence_jobs ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.claim_creator_intelligence_job(p_mint text,p_owner text,p_lease_seconds integer DEFAULT 180)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE n integer;
BEGIN
 IF p_mint !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' OR length(p_owner)<8 OR p_lease_seconds<30 OR p_lease_seconds>900 THEN RAISE EXCEPTION 'INVALID_CLAIM'; END IF;
 UPDATE public.creator_intelligence_jobs SET lease_owner=p_owner,lease_until=now()+p_lease_seconds*interval '1 second',status='running',updated_at=now()
 WHERE mint=p_mint AND status IN ('queued','partial','running') AND (lease_until IS NULL OR lease_until<now() OR lease_owner=p_owner);
 GET DIAGNOSTICS n=ROW_COUNT;RETURN n=1;
END $$;
CREATE FUNCTION public.save_creator_intelligence_progress(p_mint text,p_owner text,p_stage text,p_status text,p_state jsonb,p_request_delta integer)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE n integer;
BEGIN
 IF p_mint !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' OR length(p_owner)<8 OR p_stage NOT IN ('identification','holdings','selling','previous_launches','complete') OR p_status NOT IN ('queued','running','partial','complete','failed') OR jsonb_typeof(p_state)<>'object' OR p_request_delta<0 OR p_request_delta>500 THEN RAISE EXCEPTION 'INVALID_SAVE'; END IF;
 UPDATE public.creator_intelligence_jobs SET stage=p_stage,status=p_status,state=p_state,request_count_total=request_count_total+p_request_delta,
 lease_owner=CASE WHEN p_status IN ('partial','complete','failed') THEN NULL ELSE lease_owner END,
 lease_until=CASE WHEN p_status IN ('partial','complete','failed') THEN NULL ELSE lease_until END,updated_at=now()
 WHERE mint=p_mint AND lease_owner=p_owner AND lease_until>now() AND status='running';
 GET DIAGNOSTICS n=ROW_COUNT;RETURN n=1;
END $$;
-- Synthetic service roles; these are not connected credentials.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
GRANT ALL ON public.creator_intelligence_jobs TO service_role;
REVOKE EXECUTE ON FUNCTION public.claim_creator_intelligence_job(text,text,integer) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.save_creator_intelligence_progress(text,text,text,text,jsonb,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_creator_intelligence_job(text,text,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.save_creator_intelligence_progress(text,text,text,text,jsonb,integer) TO service_role;
