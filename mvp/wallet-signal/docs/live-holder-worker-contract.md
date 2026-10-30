# GLITCH live holder scan worker contract (design gate)

## Customer flow
1. GET token concentration returns current RPC top-20 balances promptly.
2. POST scan request validates Solana mint and creates/reuses a bounded scan job.
3. A trusted background worker claims the job with an atomic expiring lease.
4. Worker uses the shared holderHistoryEngine to scan one bounded batch.
5. Worker commits the updated checkpoint and releases or renews its lease.
6. GET scan status returns only publicHolderScanView output.
7. Frontend polls while running and refreshes bubble map as evidence grows.

## Security and correctness
- No service-role keys in client components, public API responses or logs.
- Never accept arbitrary RPC endpoints or checkpoint JSON from anonymous clients.
- Use atomic job claiming, unique idempotency keys, per-mint deduplication and rate limits.
- Snapshot top-20 token-account addresses, balances and supply slot at scan start.
- Detect holder-set drift; start a new snapshot rather than mixing old and new holdings.
- Scope transaction links to confirmed direct transfers, not mere transaction co-occurrence.
- Scan state is private. Return only the public projection and bounded evidence links.
- Public routes must not perform hundreds of synchronous RPC requests.
- Limit worker requests, concurrency, cost, runtime and checkpoint size.
- Definitively identified failed transactions did not settle and may be rejected as transfer evidence. Missing/malformed or identity-mismatched failure responses remain Unknown coverage gaps. Provider exhaustion is not archival proof.
- Explicit approval required before applying schema, enabling workers or deploying.

## Acceptance tests
- Two concurrent requests for the same mint do not launch duplicate jobs.
- Expired leases are recoverable without losing transaction evidence.
- A job resumes from the exact last persisted wallet cursor.
- Changes in top-20 holder set do not corrupt existing snapshots.
- API response exposes no private checkpoint fields or credentials.
- Partial scans show numerical observed metrics and scan progress.
- Full provider exhaustion is only claimed when all wallet pages and transactions are checked.
