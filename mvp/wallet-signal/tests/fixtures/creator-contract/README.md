# Disposable Creator contract reproduction

These tests reconstruct the contract supplied by the parent's read-only catalog inspection on 2026-10-27. `retained-contract.sql` is a semantic model, **not** an exact hosted function export. Column types, nullability, defaults, checks, index definitions and absence of triggers match the additional parent-verified catalog. Save uses the verified coalesced owner check; claim remains uncoalesced. The tests make no hosted call and do not establish that a particular live checkpoint experienced a race.

The candidate is [the guarded review proposal](../../../docs/proposals/creator-job-fencing-v2.sql), not an installed migration or application adapter. Run only with the existing local PostgreSQL 17 image:

```sh
docker run --rm --name creator-contract-disposable --network none \
  --tmpfs /var/lib/postgresql/data \
  -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_USER=creator_test \
  -e POSTGRES_DB=glitch_creator_contract_test -d postgres:17
docker exec creator-contract-disposable pg_isready -U creator_test -d glitch_creator_contract_test
python3 mvp/wallet-signal/tests/fixtures/creator-contract/run-local.py
# Only after the preceding suite succeeds (never in parallel):
node --require /tmp/holder-offline-guard.cjs mvp/wallet-signal/tests/fixtures/creator-contract/run-adapter-contract.mjs
docker stop creator-contract-disposable
```

Wait for readiness before running. Use a fresh container for every run; the harness refuses nonempty databases, nonisolated networking or persistent mounts. It accepts no host, SQL URI, service key or remote target. Local trust authentication is confined to this disposable container, which has no network and no published port. Do not change the guard to run against hosted storage. All rows, owners, roles, waits and the slow-write trigger are synthetic; the trigger exists only to test rollback when expiry occurs during UPDATE.

The retained model reproduces same-owner overwrites, repeated-delta accounting, transaction-start clock expiry and NULL lease arguments. The candidate tests cover fencing, atomic counters, row-lock contention, wall-clock checks before/after writes, interrupted transactions, exact revision receipts and the proposed legacy-writer cutover. There is no retry/dispatch logic or automatic invocation from a scheduled workflow.

Both suites take the same local test lock and reject overlap. The adapter suite uses injected transport backed by docker/psql, not HTTP, provider calls or hosted PostgREST. It verifies SQL serialization and contracts, not hosted HTTP delivery. The optional outbound guard shown above is the environment test guard; the SQL bridge itself hardcodes the isolated container/database and accepts no remote target.
