# Exact-job evidence validation

Evidence selection identifies one historical investigation by job ID. Its checkpoint must be loaded by that ID, with matching row/checkpoint mint. Per-mint update order does not identify the selected holder set. Missing, inconsistent, failed, or malformed jobs fail with a sanitized HTTP 503 before evidence writes.

The API validates selector, job, health, seed, claim, and finish responses. Only an exact boolean true finish counts as saved progress. A lost lease (including a partially saved batch) returns HTTP 503 and EVIDENCE_LEASE_LOST; this is a retryable attention signal, not a claim of a broken queue or permission to overwrite another worker.

Response contract:
- idle: the selector returned no job, with zero processed, claimed, leaseLost, and requestCount.
- no_claims: an exact selected job was valid but the atomic claim returned no rows. This can be a normal race or contention; it is explicitly no progress, not a completed validation.
- processed: at least one claimed record finished successfully. All claims must finish successfully for HTTP 200. This counts recorded verification attempts, including retryable unavailable results; it does not mean every transaction was verified.
- All HTTP 200 responses include the eight nonnegative integer health counters. The workflow rejects expired leases and exhausted retries.
- requestCount = claimed = processed + leaseLost, with a maximum of six claims per batch. queuedSignatures describes a captured checkpoint and is not a persistence or archival-completeness measure.

Regression checks use fake stores, RPC responses, and HTTP only. The compiled-route check runs after npm run build. These checks establish code behavior, not live database persistence, complete history, or production readiness.

The separately registered main-branch workflow also needs the same strict response guard. Its change is reviewed separately; development PR approval does not change main or the configured worker Preview target.
