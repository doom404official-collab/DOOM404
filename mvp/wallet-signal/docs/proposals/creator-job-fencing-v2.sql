-- REVIEW PROPOSAL, NOT A MIGRATION. NEVER RUN AGAINST HOSTED STORAGE.
-- Executable only in the named disposable test DB. A future approved migration
-- must be separately prepared after quiescence, compatibility and rollback review.
BEGIN;
DO $$ BEGIN
 IF current_database()<>'glitch_creator_contract_test' THEN RAISE EXCEPTION 'DISPOSABLE_CREATOR_DATABASE_REQUIRED'; END IF;
END $$;
ALTER TABLE public.creator_intelligence_jobs ADD COLUMN revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0);
COMMENT ON COLUMN public.creator_intelligence_jobs.revision IS 'Write fencing revision; not evidence completeness or historical checkpoint schema version';
CREATE FUNCTION public.claim_creator_intelligence_job_v2(p_mint text,p_owner text,p_expected_revision bigint,p_lease_seconds integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE v record; t timestamptz; out_revision bigint; out_until timestamptz;
BEGIN
 IF p_mint IS NULL OR p_mint !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' OR p_owner IS NULL OR length(p_owner)<8 OR
 p_expected_revision IS NULL OR p_expected_revision<0 OR p_expected_revision>=9223372036854775807 OR
 p_lease_seconds IS NULL OR p_lease_seconds<30 OR p_lease_seconds>180 THEN RAISE EXCEPTION 'INVALID_CREATOR_V2_CLAIM'; END IF;
 BEGIN
  SELECT revision,status,lease_owner,lease_until INTO v FROM public.creator_intelligence_jobs WHERE mint=p_mint FOR UPDATE NOWAIT;
 EXCEPTION WHEN lock_not_available THEN RETURN NULL;
 END;
 IF NOT FOUND THEN RETURN NULL; END IF;
 t=clock_timestamp();
 IF v.revision<>p_expected_revision OR v.status IS NULL OR v.status NOT IN ('queued','partial','running') OR
 (v.lease_owner IS NULL)<>(v.lease_until IS NULL) OR (v.lease_until IS NOT NULL AND v.lease_until>t) THEN RETURN NULL; END IF;
 UPDATE public.creator_intelligence_jobs SET lease_owner=p_owner,lease_until=t+p_lease_seconds*interval '1 second',status='running',revision=revision+1,updated_at=t
 WHERE mint=p_mint RETURNING revision,lease_until INTO out_revision,out_until;
 IF out_until<=clock_timestamp() THEN RAISE EXCEPTION 'CREATOR_V2_LEASE_EXPIRED'; END IF;
 RETURN jsonb_build_object('mint',p_mint,'owner',p_owner,'revision',out_revision::text,'leaseUntil',out_until,'status','running');
END $$;
CREATE FUNCTION public.save_creator_intelligence_progress_v2(p_mint text,p_owner text,p_expected_revision bigint,p_stage text,p_status text,p_state jsonb,p_request_delta integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE v record; t timestamptz; out_revision bigint; out_until timestamptz;
BEGIN
 IF p_mint IS NULL OR p_mint !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' OR p_owner IS NULL OR length(p_owner)<8 OR
 p_expected_revision IS NULL OR p_expected_revision<0 OR p_expected_revision>=9223372036854775807 OR
 p_stage IS NULL OR p_stage NOT IN ('identification','holdings','selling','previous_launches','complete') OR
 p_status IS NULL OR p_status NOT IN ('running','partial','complete','failed') OR
 p_state IS NULL OR jsonb_typeof(p_state)<>'object' OR p_request_delta IS NULL OR p_request_delta<0 OR p_request_delta>500
 THEN RAISE EXCEPTION 'INVALID_CREATOR_V2_SAVE'; END IF;
 BEGIN
  SELECT revision,status,lease_owner,lease_until INTO v FROM public.creator_intelligence_jobs WHERE mint=p_mint FOR UPDATE NOWAIT;
 EXCEPTION WHEN lock_not_available THEN RETURN NULL;
 END;
 IF NOT FOUND THEN RETURN NULL; END IF;
 t=clock_timestamp();
 IF v.revision<>p_expected_revision OR v.status IS DISTINCT FROM 'running' OR v.lease_owner IS DISTINCT FROM p_owner OR v.lease_until IS NULL OR v.lease_until<=t THEN RETURN NULL; END IF;
 UPDATE public.creator_intelligence_jobs SET stage=p_stage,status=p_status,state=p_state,request_count_total=request_count_total+p_request_delta,
 lease_owner=CASE WHEN p_status='running' THEN p_owner ELSE NULL END,
 lease_until=CASE WHEN p_status='running' THEN v.lease_until ELSE NULL END,revision=revision+1,updated_at=t
 WHERE mint=p_mint RETURNING revision,lease_until INTO out_revision,out_until;
 -- A long write that crosses expiry must roll back, not return acknowledged success.
 IF v.lease_until<=clock_timestamp() THEN RAISE EXCEPTION 'CREATOR_V2_LEASE_EXPIRED'; END IF;
 RETURN jsonb_build_object('mint',p_mint,'owner',CASE WHEN p_status='running' THEN p_owner ELSE NULL END,'revision',out_revision::text,'leaseUntil',out_until,'status',p_status);
END $$;
-- Proposed coordinated cutover only: old writers must not bypass revision fencing.
-- Tests create these roles locally. No hosted grants have been changed.
REVOKE EXECUTE ON FUNCTION public.claim_creator_intelligence_job(text,text,integer) FROM PUBLIC,anon,authenticated,service_role;
REVOKE EXECUTE ON FUNCTION public.save_creator_intelligence_progress(text,text,text,text,jsonb,integer) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.claim_creator_intelligence_job_v2(text,text,bigint,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.save_creator_intelligence_progress_v2(text,text,bigint,text,text,jsonb,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_creator_intelligence_job_v2(text,text,bigint,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.save_creator_intelligence_progress_v2(text,text,bigint,text,text,jsonb,integer) TO service_role;
COMMIT;
