-- REVIEW/TEST ARTIFACT ONLY. Not authorized for execution until gates pass.
-- Renderer supplies the validated JSON manifest below (not SQL).
-- No persistent objects, new credentials, or direct checkpoint UPDATE.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DO $merge_20896b3ecb6a4d7385db59e8fe0a05bc$
DECLARE
  m jsonb := $manifest_20896b3ecb6a4d7385db59e8fe0a05bc${"operation":"holder-original-three-once-v1","workerId":"83068dbf-3838-487e-b921-b4322676c872","job":{"id":"11111111-1111-4111-8111-111111111111","mint":"77777777777777777777777777777777","holder_set_hash":"disposable-only","status":"partial","checkpoint":{"mint":"77777777777777777777777777777777","snapshot":null,"holders":[],"signatures":{"4444444444444444444444444444444444444444444444444444444444444444444444444444444444444444":"checked","5555555555555555555555555555555555555555555555555555555555555555555555555555555555555555":"checked","6666666666666666666666666666666666666666666666666666666666666666666666666666666666666666":"checked"},"archiveCompletenessProven":false,"networkEvidence":{"version":1,"snapshotIdentity":"{\"mint\":\"77777777777777777777777777777777\",\"snapshot\":null,\"holders\":[]}","processed":{},"transfers":[],"retentionLimited":false}},"summary":{"score":null,"testOnly":true},"lease_owner":null,"lease_expires_at":null,"version":40,"created_at":"2026-10-21T00:00:00+00:00","updated_at":"2026-10-21T00:00:00+00:00"},"evidenceRows":[{"job_id":"11111111-1111-4111-8111-111111111111","signature":"4444444444444444444444444444444444444444444444444444444444444444444444444444444444444444","status":"verified","evidence":{"networkExtraction":{"version":1,"valid":true,"unresolvedTokenTransfers":0,"transfers":[{"signature":"4444444444444444444444444444444444444444444444444444444444444444444444444444444444444444","slot":100,"from":"22222222222222222222222222222222","to":"33333333333333333333333333333333","assetType":"SOL","mint":null,"amountRaw":"1","verifiedOnChain":true,"transferVerified":true},{"signature":"4444444444444444444444444444444444444444444444444444444444444444444444444444444444444444","slot":100,"from":"22222222222222222222222222222222","to":"33333333333333333333333333333333","assetType":"SOL","mint":null,"amountRaw":"2","verifiedOnChain":true,"transferVerified":true},{"signature":"4444444444444444444444444444444444444444444444444444444444444444444444444444444444444444","slot":100,"from":"22222222222222222222222222222222","to":"33333333333333333333333333333333","assetType":"SOL","mint":null,"amountRaw":"3","verifiedOnChain":true,"transferVerified":true},{"signature":"4444444444444444444444444444444444444444444444444444444444444444444444444444444444444444","slot":100,"from":"22222222222222222222222222222222","to":"33333333333333333333333333333333","assetType":"SOL","mint":null,"amountRaw":"4","verifiedOnChain":true,"transferVerified":true},{"signature":"4444444444444444444444444444444444444444444444444444444444444444444444444444444444444444","slot":100,"from":"22222222222222222222222222222222","to":"33333333333333333333333333333333","assetType":"SOL","mint":null,"amountRaw":"5","verifiedOnChain":true,"transferVerified":true},{"signature":"4444444444444444444444444444444444444444444444444444444444444444444444444444444444444444","slot":100,"from":"22222222222222222222222222222222","to":"33333333333333333333333333333333","assetType":"SOL","mint":null,"amountRaw":"6","verifiedOnChain":true,"transferVerified":true},{"signature":"4444444444444444444444444444444444444444444444444444444444444444444444444444444444444444","slot":100,"from":"22222222222222222222222222222222","to":"33333333333333333333333333333333","assetType":"SOL","mint":null,"amountRaw":"7","verifiedOnChain":true,"transferVerified":true}]}},"attempts":1,"checked_at":"2026-10-21T00:00:00+00:00","lease_owner":null,"lease_expires_at":null},{"job_id":"11111111-1111-4111-8111-111111111111","signature":"5555555555555555555555555555555555555555555555555555555555555555555555555555555555555555","status":"verified","evidence":{"networkExtraction":{"version":1,"valid":true,"unresolvedTokenTransfers":0,"transfers":[{"signature":"5555555555555555555555555555555555555555555555555555555555555555555555555555555555555555","slot":100,"from":"22222222222222222222222222222222","to":"33333333333333333333333333333333","assetType":"SOL","mint":null,"amountRaw":"1","verifiedOnChain":true,"transferVerified":true}]}},"attempts":1,"checked_at":"2026-10-21T00:00:00+00:00","lease_owner":null,"lease_expires_at":null},{"job_id":"11111111-1111-4111-8111-111111111111","signature":"6666666666666666666666666666666666666666666666666666666666666666666666666666666666666666","status":"verified","evidence":{"networkExtraction":{"version":1,"valid":true,"unresolvedTokenTransfers":0,"transfers":[{"signature":"6666666666666666666666666666666666666666666666666666666666666666666666666666666666666666","slot":100,"from":"22222222222222222222222222222222","to":"33333333333333333333333333333333","assetType":"SOL","mint":null,"amountRaw":"1","verifiedOnChain":true,"transferVerified":true},{"signature":"6666666666666666666666666666666666666666666666666666666666666666666666666666666666666666","slot":100,"from":"22222222222222222222222222222222","to":"33333333333333333333333333333333","assetType":"SOL","mint":null,"amountRaw":"2","verifiedOnChain":true,"transferVerified":true},{"signature":"6666666666666666666666666666666666666666666666666666666666666666666666666666666666666666","slot":100,"from":"22222222222222222222222222222222","to":"33333333333333333333333333333333","assetType":"SOL","mint":null,"amountRaw":"3","verifiedOnChain":true,"transferVerified":true},{"signature":"6666666666666666666666666666666666666666666666666666666666666666666666666666666666666666","slot":100,"from":"22222222222222222222222222222222","to":"33333333333333333333333333333333","assetType":"SOL","mint":null,"amountRaw":"4","verifiedOnChain":true,"transferVerified":true}]}},"attempts":1,"checked_at":"2026-10-21T00:00:00+00:00","lease_owner":null,"lease_expires_at":null}],"snapshotIdentity":"{\"mint\":\"77777777777777777777777777777777\",\"snapshot\":null,\"holders\":[]}","preparedCheckpoint":{"mint":"77777777777777777777777777777777","snapshot":null,"holders":[],"signatures":{"4444444444444444444444444444444444444444444444444444444444444444444444444444444444444444":"checked","5555555555555555555555555555555555555555555555555555555555555555555555555555555555555555":"checked","6666666666666666666666666666666666666666666666666666666666666666666666666666666666666666":"checked"},"archiveCompletenessProven":false,"networkEvidence":{"version":1,"snapshotIdentity":"{\"mint\":\"77777777777777777777777777777777\",\"snapshot\":null,\"holders\":[]}","processed":{"4444444444444444444444444444444444444444444444444444444444444444444444444444444444444444":{"valid":true,"unresolvedTokenTransfers":0,"transferCount":7},"5555555555555555555555555555555555555555555555555555555555555555555555555555555555555555":{"valid":true,"unresolvedTokenTransfers":0,"transferCount":1},"6666666666666666666666666666666666666666666666666666666666666666666666666666666666666666":{"valid":true,"unresolvedTokenTransfers":0,"transferCount":4}},"transfers":[{"signature":"4444444444444444444444444444444444444444444444444444444444444444444444444444444444444444","slot":100,"from":"22222222222222222222222222222222","to":"33333333333333333333333333333333","assetType":"SOL","mint":null,"amountRaw":"1","verifiedOnChain":true,"transferVerified":true},{"signature":"4444444444444444444444444444444444444444444444444444444444444444444444444444444444444444","slot":100,"from":"22222222222222222222222222222222","to":"33333333333333333333333333333333","assetType":"SOL","mint":null,"amountRaw":"2","verifiedOnChain":true,"transferVerified":true},{"signature":"4444444444444444444444444444444444444444444444444444444444444444444444444444444444444444","slot":100,"from":"22222222222222222222222222222222","to":"33333333333333333333333333333333","assetType":"SOL","mint":null,"amountRaw":"3","verifiedOnChain":true,"transferVerified":true},{"signature":"4444444444444444444444444444444444444444444444444444444444444444444444444444444444444444","slot":100,"from":"22222222222222222222222222222222","to":"33333333333333333333333333333333","assetType":"SOL","mint":null,"amountRaw":"4","verifiedOnChain":true,"transferVerified":true},{"signature":"4444444444444444444444444444444444444444444444444444444444444444444444444444444444444444","slot":100,"from":"22222222222222222222222222222222","to":"33333333333333333333333333333333","assetType":"SOL","mint":null,"amountRaw":"5","verifiedOnChain":true,"transferVerified":true},{"signature":"4444444444444444444444444444444444444444444444444444444444444444444444444444444444444444","slot":100,"from":"22222222222222222222222222222222","to":"33333333333333333333333333333333","assetType":"SOL","mint":null,"amountRaw":"6","verifiedOnChain":true,"transferVerified":true},{"signature":"4444444444444444444444444444444444444444444444444444444444444444444444444444444444444444","slot":100,"from":"22222222222222222222222222222222","to":"33333333333333333333333333333333","assetType":"SOL","mint":null,"amountRaw":"7","verifiedOnChain":true,"transferVerified":true},{"signature":"5555555555555555555555555555555555555555555555555555555555555555555555555555555555555555","slot":100,"from":"22222222222222222222222222222222","to":"33333333333333333333333333333333","assetType":"SOL","mint":null,"amountRaw":"1","verifiedOnChain":true,"transferVerified":true},{"signature":"6666666666666666666666666666666666666666666666666666666666666666666666666666666666666666","slot":100,"from":"22222222222222222222222222222222","to":"33333333333333333333333333333333","assetType":"SOL","mint":null,"amountRaw":"1","verifiedOnChain":true,"transferVerified":true},{"signature":"6666666666666666666666666666666666666666666666666666666666666666666666666666666666666666","slot":100,"from":"22222222222222222222222222222222","to":"33333333333333333333333333333333","assetType":"SOL","mint":null,"amountRaw":"2","verifiedOnChain":true,"transferVerified":true},{"signature":"6666666666666666666666666666666666666666666666666666666666666666666666666666666666666666","slot":100,"from":"22222222222222222222222222222222","to":"33333333333333333333333333333333","assetType":"SOL","mint":null,"amountRaw":"3","verifiedOnChain":true,"transferVerified":true},{"signature":"6666666666666666666666666666666666666666666666666666666666666666666666666666666666666666","slot":100,"from":"22222222222222222222222222222222","to":"33333333333333333333333333333333","assetType":"SOL","mint":null,"amountRaw":"4","verifiedOnChain":true,"transferVerified":true}],"retentionLimited":false}}}$manifest_20896b3ecb6a4d7385db59e8fe0a05bc$::jsonb;
  j public.glitch_holder_scan_jobs%ROWTYPE;
  claimed public.glitch_holder_scan_jobs%ROWTYPE;
  committed public.glitch_holder_scan_jobs%ROWTYPE;
  item jsonb;
  actual_evidence jsonb;
  next_checkpoint jsonb;
  sig text;
  worker uuid;
  n integer := 0;
  added integer := 0;
  expected_sigs text[] := ARRAY[
    '4444444444444444444444444444444444444444444444444444444444444444444444444444444444444444',
    '5555555555555555555555555555555555555555555555555555555555555555555555555555555555555555',
    '6666666666666666666666666666666666666666666666666666666666666666666666666666666666666666'
  ];
BEGIN
  IF m->>'operation' IS DISTINCT FROM 'holder-original-three-once-v1'
     OR m#>>'{job,id}' IS DISTINCT FROM '11111111-1111-4111-8111-111111111111'
     OR m#>>'{job,mint}' IS DISTINCT FROM '77777777777777777777777777777777'
     OR jsonb_typeof(m->'evidenceRows') IS DISTINCT FROM 'array'
     OR jsonb_array_length(m->'evidenceRows') <> 3
     OR (SELECT array_agg(x->>'signature' ORDER BY x->>'signature') FROM jsonb_array_elements(m->'evidenceRows') x) IS DISTINCT FROM expected_sigs
  THEN RAISE EXCEPTION 'MERGE_MANIFEST_INVALID'; END IF;
  worker := (m->>'workerId')::uuid;
  IF worker IS NULL THEN RAISE EXCEPTION 'MERGE_WORKER_REQUIRED'; END IF;

  SELECT * INTO STRICT j FROM public.glitch_holder_scan_jobs
    WHERE id = (m#>>'{job,id}')::uuid FOR UPDATE NOWAIT;
  -- Canonical JSONB equality pins every current job field, including summary,
  -- checkpoint, version, status, lease metadata and timestamps.
  IF to_jsonb(j) IS DISTINCT FROM m->'job' THEN RAISE EXCEPTION 'MERGE_JOB_CHANGED'; END IF;
  IF j.checkpoint#>>'{networkEvidence,snapshotIdentity}' IS DISTINCT FROM m->>'snapshotIdentity'
     OR j.checkpoint#>'{networkEvidence,retentionLimited}' IS DISTINCT FROM 'false'::jsonb
     OR j.checkpoint#>'{networkEvidence,version}' IS DISTINCT FROM '1'::jsonb
     OR jsonb_typeof(j.checkpoint#>'{networkEvidence,processed}') IS DISTINCT FROM 'object'
     OR jsonb_typeof(j.checkpoint#>'{networkEvidence,transfers}') IS DISTINCT FROM 'array'
  THEN RAISE EXCEPTION 'MERGE_CHECKPOINT_INVALID'; END IF;
  next_checkpoint := j.checkpoint;

  -- Deterministic lock order. Row locks prevent PATCH/finish from modifying any
  -- selected source until this transaction commits or rolls back.
  FOR item IN SELECT x FROM jsonb_array_elements(m->'evidenceRows') x ORDER BY x->>'signature'
  LOOP
    sig := item->>'signature';
    SELECT to_jsonb(e) INTO STRICT actual_evidence
      FROM public.glitch_holder_evidence_validation e
      WHERE e.job_id=j.id AND e.signature=sig FOR UPDATE NOWAIT;
    IF actual_evidence IS DISTINCT FROM item OR item->>'status' IS DISTINCT FROM 'verified'
       OR item#>'{evidence,networkExtraction,version}' IS DISTINCT FROM '1'::jsonb
       OR item#>'{evidence,networkExtraction,valid}' IS DISTINCT FROM 'true'::jsonb
       OR item#>'{evidence,networkExtraction,unresolvedTokenTransfers}' IS DISTINCT FROM '0'::jsonb
       OR jsonb_typeof(item#>'{evidence,networkExtraction,transfers}') IS DISTINCT FROM 'array'
       OR j.checkpoint->'signatures'->>sig IS DISTINCT FROM 'checked'
       OR (j.checkpoint#>'{networkEvidence,processed}') ? sig
    THEN RAISE EXCEPTION 'MERGE_EVIDENCE_CHANGED_OR_INVALID'; END IF;
    n := n+1;
    IF jsonb_array_length(item#>'{evidence,networkExtraction,transfers}') <>
       CASE n WHEN 1 THEN 7 WHEN 2 THEN 1 WHEN 3 THEN 4 END
    THEN RAISE EXCEPTION 'MERGE_TRANSFER_COUNT_CHANGED'; END IF;
    added := added + jsonb_array_length(item#>'{evidence,networkExtraction,transfers}');
    next_checkpoint := jsonb_set(next_checkpoint, ARRAY['networkEvidence','processed',sig],
      jsonb_build_object('valid',true,'unresolvedTokenTransfers',0,
        'transferCount',jsonb_array_length(item#>'{evidence,networkExtraction,transfers}')),true);
    next_checkpoint := jsonb_set(next_checkpoint, '{networkEvidence,transfers}',
      (next_checkpoint#>'{networkEvidence,transfers}') || (item#>'{evidence,networkExtraction,transfers}'));
  END LOOP;
  IF n<>3 OR added<>12 OR next_checkpoint IS DISTINCT FROM m->'preparedCheckpoint'
     OR (SELECT count(*) FROM jsonb_object_keys(next_checkpoint#>'{networkEvidence,processed}'))>20000
     OR jsonb_array_length(next_checkpoint#>'{networkEvidence,transfers}')>20000
  THEN RAISE EXCEPTION 'MERGE_PREPARED_DIFF_INVALID'; END IF;

  SELECT * INTO claimed FROM public.glitch_claim_holder_scan(j.id,worker,90);
  IF claimed.id IS DISTINCT FROM j.id OR claimed.version IS DISTINCT FROM j.version+1
     OR claimed.status IS DISTINCT FROM 'running' OR claimed.mint IS DISTINCT FROM j.mint
     OR claimed.checkpoint IS DISTINCT FROM j.checkpoint OR claimed.summary IS DISTINCT FROM j.summary
  THEN RAISE EXCEPTION 'MERGE_CLAIM_FAILED'; END IF;
  SELECT * INTO committed FROM public.glitch_commit_holder_scan(
    j.id,worker,claimed.version,next_checkpoint,j.summary,'partial');
  IF committed.id IS DISTINCT FROM j.id OR committed.version IS DISTINCT FROM j.version+2
     OR committed.checkpoint IS DISTINCT FROM next_checkpoint
     OR committed.summary IS DISTINCT FROM j.summary OR committed.status IS DISTINCT FROM 'partial'
     OR committed.lease_owner IS NOT NULL OR committed.lease_expires_at IS NOT NULL
     OR (to_jsonb(committed)-ARRAY['checkpoint','status','version','lease_owner','lease_expires_at','updated_at'])
        IS DISTINCT FROM (to_jsonb(j)-ARRAY['checkpoint','status','version','lease_owner','lease_expires_at','updated_at'])
  THEN RAISE EXCEPTION 'MERGE_COMMIT_FAILED'; END IF;
  -- This is provisional until COMMIT succeeds and a separate readback agrees.
  RAISE NOTICE 'MERGE_PREPARED job=% version=% signatures=3 transfers=12 scorePromoted=false',j.id,committed.version;
END
$merge_20896b3ecb6a4d7385db59e8fe0a05bc$;
COMMIT;

