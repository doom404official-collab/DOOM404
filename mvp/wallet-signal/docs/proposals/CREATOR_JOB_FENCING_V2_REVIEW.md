# Creator job fencing: proposal for parent review

**Status: unapplied, no client adapter, no owner activation request.** This proposal addresses CI-14/15 concurrency gaps; it does not complete either gate. The production client remains at reviewed 349272e and uses the current contract. The SQL is guarded to the disposable test database and is outside migration/autodeploy paths. It must not be edited in place to run on hosted storage; an approved migration would be prepared separately.

## Evidence and scope

The parent supplied read-only catalog facts on 2026-10-27: mint identifies the job; `lease_owner`/`lease_until` are nullable; there is no write revision. Claim permits active same-owner reclaims. Save requires the current owner, running status and a live lease; running saves do not renew it. State replacement and request-delta addition are atomic together, but are not conditional on the checkpoint read by the writer. Both functions use transaction-start `now()` and ordinary IF expressions that do not reject every NULL argument.

Disposable PostgreSQL tests reconstruct those supplied semantics. They demonstrate possible races, not a diagnosed incident in the historical Creator job. Unreported non-lease column nullability is explicitly a model assumption; no conclusion depends on NULL state/status successfully passing an unknown hosted table constraint. The nullable-owner/duration cases and same-owner/clock behaviors follow the supplied contract.

## Proposed contract, requiring approval

1. Add `revision BIGINT NOT NULL DEFAULT 0 CHECK (revision >= 0)`. This is a new write-fencing counter, not evidence version, coverage or reconstructed history. Existing state/cursors/counters and identity remain unchanged; the tests compare every existing row field before/after the addition.
2. Use separately named V2 claim/save RPCs with mandatory expected revision. Claim increments revision and never reclaims an active lease, even for the same owner. Save atomically compares owner/revision/status/expiry, replaces state, adds its request delta and increments revision. Competing saves at the same revision cannot both succeed. Inconsistent nullable lease metadata requires reconciliation, not automatic repair.
3. Explicitly reject SQL NULLs, malformed state and out-of-range inputs. Proposed lease range is 30–180 seconds, matching the client's existing maximum rather than the broader legacy SQL allowance. The current runner still requests 180 seconds. Proposed save permits running/partial/complete/failed; queued is an enqueue state, not a progress-save transition. Both restrictions are intentional compatibility changes for review, not silently approved policy.
4. Acquire the row with NOWAIT; contention returns no applied receipt. Check `clock_timestamp()` after locking and again after updating. Expiry during a slow UPDATE raises and rolls back state, counter and revision. Running saves retain the existing expiry; no renewal endpoint or duration expansion is proposed. Transaction completion after the function returns is not a new global timing guarantee.
5. Return a compact receipt with mint, owner, decimal-string revision, status and lease expiry. No raw checkpoint is returned. A future adapter must verify identity and exact revision, preserve the lease deadline, and reread/compare the checkpoint after claim. Revision strings prevent JSON Number rounding; unsafe or mismatched metadata must fail closed.
6. Revoke legacy RPC execution at the coordinated cutover and grant the new RPCs only to the existing authorized server role. No new credentials or broader access are proposed. Legacy endpoints left executable can bypass revision fencing. Direct table writes by privileged code also bypass the contract: the approved operational scope must prohibit them, and inventory must establish no such active writer.

Exact candidate SQL: [creator-job-fencing-v2.sql](creator-job-fencing-v2.sql). It is executable only in the synthetic disposable database. There is no V2 adapter, flag or workflow integration in this change set.

## Required compatibility and quiescence review

Before any approval request, parent must review the full hosted table DDL (including defaults, constraints, indexes and dependent functions), compare the modeled function semantics with the exact retained definitions, and review this SQL against that catalog. The test fixture is not a substitute for those checks.

Inventory all old clients, queued/running Actions jobs and direct writers, including older branches/deployments. The known durable runner is `creator-worker-run.mjs`; workflow-level concurrency alone cannot protect against every old/manual caller. Obtain explicit authorization for any required pause/configuration/deployment or migration. No pause is performed here.

For an approved cutover: drain workers and in-flight database transactions; prevent scheduled/manual reentry; wait until leases are inactive using the database wall clock. Record each job's identity, stage/status, checkpoint hash/size, counters and lease metadata read-only. Do not migrate during an uncertain commit or active writer. A single reviewed transaction should add revision, install/restrict V2 functions and disable legacy writes. Check pre/post state equality and permissions, then deploy the separately reviewed V2 adapter while execution remains disabled. Validate only with a separately authorized bounded attempt. Do not restart the known historical job as part of migration validation.

A future adapter must consume each returned revision for subsequent writes, preserve the running-save reservation semantics, and stop on missing/conflicting/uncertain receipts. It must not renew automatically, retry POSTs, reset checkpoints, synthesize coverage or assume revision proves provenance. Atomic stored request deltas still do not prove all calls preceding a process crash; uncertain outcomes require independent reconciliation.

## Rollback and unresolved acceptance

Prefer fail-stop if cutover validation fails. Roll back an uncommitted migration transaction. After commit, retain revision and checkpoint/counter history; disable new execution and reconcile rather than dropping/resetting revisions. Re-enabling legacy writers would restore the reproduced race and requires a separately reviewed/approved decision after all V2 workers drain. A source revert alone cannot reverse a database write or safely reopen old RPCs.

Owner approval is not requested by this document. Parent review precedes any migration, permission transition, pause, adapter activation or live test. Historical ownership/allocation/coverage, calibrated scoring and release remain independently blocked. No scoring formula, request ceiling, checkpoint content, recurring schedule or hosted setting has changed.
