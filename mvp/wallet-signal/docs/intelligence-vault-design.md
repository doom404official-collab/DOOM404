# DOOM404 Intelligence Vault — storage and reuse policy

Status: schema committed; no database provisioned, migration executed, or production change.

## Core principles
1. Check local database before external providers.
2. Store publicly available on-chain facts, evidence references, source, decoder version, and verification status separately.
3. A cached INDEXED_UNVERIFIED label never becomes VERIFIED merely because it is cached.
4. Preserve contradictory evidence and audit history; do not silently overwrite a previously verified creator.
5. Store historical transactions by signature, deduplicated. A new decoder can reprocess stored normalized evidence, but retain source transaction signature.
6. Dynamic wallet holdings, balances, token market data and security signals need timestamped snapshots, refresh policy and source licensing review.
7. Never persist provider API keys, bearer tokens, raw HTTP headers, or arbitrary provider responses.
8. Treat external provider retention and redistribution rights as separate from public on-chain transaction facts.
9. Store investigation checkpoints per mint and indexed creator; version their schema and reject mismatched resumes.
10. Default database access to private service-side operations. Add RLS/roles, retention, backups, and migration rollback before deployment.

## Suggested cache rules
- Confirmed on-chain creation transaction and mint: long-lived, revalidate only on decoder/protocol updates or contradiction.
- Indexed creator without on-chain proof: cache with source timestamp; refresh periodically and on discrepancy.
- Wallet balances and current holdings: short TTL, depending on feature and provider budget.
- Risk scores: versioned derived snapshots with underlying evidence and expiry.
- Provider failures: short negative-cache TTL, never permanent attribution failure.

## Rollout
A. Approve database vendor and budget; do not create paid resources automatically.
B. Apply reviewed migration to isolated Preview database with least-privilege credentials.
C. Implement transactional upserts and read-through cache with source/role checks.
D. Implement resumable one-token worker with strict RPC budget and per-mint lock.
E. Test known transaction plus five independent tokens; verify cache hit uses zero external calls.
F. Only after approval integrate into production GLITCH Scanner.
