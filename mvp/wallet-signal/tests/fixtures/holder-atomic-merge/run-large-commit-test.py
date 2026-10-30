"""Offline synthetic JSONB commit check after run-disposable-tests.py.
Requires its initialized disposable local database; transaction always rolls back.
Does not reproduce hosted PostgREST, proxy limits, or hosted statement timeouts.
"""
import json, os, subprocess, time

assert os.environ.get('PGDATABASE') == 'glitch_controlled_merge_test'
assert os.environ.get('PGHOST') in ('localhost', '127.0.0.1', '::1')
mint = '7' * 32
signatures = {str(i).zfill(88): 'checked' for i in range(15000)}
transfers = [dict(signature=str(i).zfill(88), slot=450097547,
    **{'from': '3' * 44, 'to': '4' * 44}, assetType='TOKEN', mint=mint,
    amountRaw='12345678901234567890', verifiedOnChain=True, transferVerified=True,
    sourceTokenAccount='5' * 44, destinationTokenAccount='6' * 44) for i in range(9500)]
checkpoint = dict(version=1, mint=mint, signatures=signatures,
    archiveCompletenessProven=False, networkEvidence=dict(version=1,
    processed={s: dict(valid=True, transferCount=int(i < 9500)) for i, s in enumerate(signatures)},
    transfers=transfers, retentionLimited=False))
payload = json.dumps(checkpoint, separators=(',', ':'))
assert 7_500_000 < len(payload.encode()) < 9_000_000
sql = """
BEGIN;
SET LOCAL statement_timeout='8s';
CREATE TEMP TABLE large_commit_input AS SELECT %s::jsonb AS checkpoint;
DO $test$
DECLARE r public.glitch_holder_scan_jobs; old_checkpoint jsonb;
BEGIN
 SELECT checkpoint INTO old_checkpoint FROM public.glitch_holder_scan_jobs WHERE id='11111111-1111-4111-8111-111111111111';
 UPDATE public.glitch_holder_scan_jobs SET status='partial',lease_owner=NULL,lease_expires_at=NULL,version=2134 WHERE id='11111111-1111-4111-8111-111111111111';
 SELECT * INTO r FROM glitch_claim_holder_scan('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222',90);
 IF r.version IS DISTINCT FROM 2135 THEN RAISE EXCEPTION 'claim mismatch'; END IF;
 SELECT * INTO r FROM glitch_renew_holder_scan(r.id,r.lease_owner,r.version,90);
 IF r.version IS DISTINCT FROM 2136 THEN RAISE EXCEPTION 'renew mismatch'; END IF;
 SELECT * INTO r FROM glitch_commit_holder_scan(r.id,r.lease_owner,r.version,(SELECT checkpoint FROM large_commit_input),'{"score":null,"scorePromoted":false}'::jsonb,'partial');
 IF r.version IS DISTINCT FROM 2137 OR r.lease_owner IS NOT NULL OR r.lease_expires_at IS NOT NULL OR r.checkpoint IS DISTINCT FROM (SELECT checkpoint FROM large_commit_input) THEN RAISE EXCEPTION 'large commit mismatch'; END IF;
 IF r.summary IS DISTINCT FROM '{"score":null,"scorePromoted":false}'::jsonb THEN RAISE EXCEPTION 'summary mismatch'; END IF;
END $test$;
ROLLBACK;
""" % ("'" + payload.replace("'", "''") + "'")
started = time.monotonic()
result = subprocess.run([os.environ.get('PSQL', 'psql'), '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1'], input=sql, text=True, capture_output=True)
assert result.returncode == 0, 'Local large commit check failed (inspect local PostgreSQL diagnostics)'
print(f'PASS synthetic {len(payload.encode())}-byte checkpoint: claim + renew + exact JSONB commit, transaction rolled back; {time.monotonic()-started:.2f}s local elapsed')
