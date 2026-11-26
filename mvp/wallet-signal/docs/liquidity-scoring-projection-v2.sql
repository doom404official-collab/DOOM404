-- Applied through Supabase migration liquidity_scoring_projection_v2.
-- Admit completed version-2 envelopes without changing existing rows or grants.
SET LOCAL lock_timeout = '3s';
ALTER TABLE public.liquidity_evidence_checkpoints
 DROP CONSTRAINT liquidity_evidence_checkpoints_status_check,
 ADD CONSTRAINT liquidity_evidence_checkpoints_status_check CHECK (
  status IN ('partial','account_checks_completed') OR
  (status='complete' AND schema_version=2 AND coalesce(evidence->>'schemaVersion'='2',false))
 );
ALTER TABLE public.liquidity_evidence_snapshots
 DROP CONSTRAINT liquidity_evidence_snapshots_status_check,
 ADD CONSTRAINT liquidity_evidence_snapshots_status_check CHECK (
  status IN ('partial','account_checks_completed') OR
  (status='complete' AND coalesce(evidence->>'schemaVersion'='2',false))
 );
