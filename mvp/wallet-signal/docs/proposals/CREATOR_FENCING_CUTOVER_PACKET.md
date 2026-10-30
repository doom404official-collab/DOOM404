# Creator fencing cutover packet — parent review only

**Inactive preparation. No approval request is sent. No migration, pause, permission change, adapter activation or live test is authorized by this packet.** Scope is only fencing writes to the existing Creator job table. Historical/scoring gates remain separate.

## Reviewed preparation

The disposable schema now matches the parent-verified column types, nullability, defaults, checks, two index definitions and absence of non-internal triggers. Claim's owner check is uncoalesced; save uses `length(coalesce(p_owner,''))`. Function text is a semantic reconstruction of the verified contract, not a byte-for-byte export. PostgreSQL tests verify the catalog and both contracts.

[Candidate SQL](creator-job-fencing-v2.sql) remains guarded to the disposable database. It adds one fencing revision, requires expected revisions, rejects active same-owner reclaim/NULL inputs, and checks wall-clock expiry before/after a write. The proposed 30–180 second lease range and exclusion of queued progress saves tighten legacy behavior and require approval. No renewal function is proposed.

[Prepared adapter](../../lib/creatorIntelligenceJobStoreV2.mjs) throws `CREATOR_V2_DISABLED` unless explicitly enabled by its caller. No environment variable activates it and no runner, route or deployed entry point imports it. It deliberately has a different interface from the legacy store: explicit read/claim/save inputs, no enqueue and no fallback. It reads revision/counter columns as text, requires canonical bounded decimal revisions, verifies compact receipts and the claimed checkpoint, preserves the exact lease expiry, and stops further writes after conflicts/uncertain outcomes. Reconciliation reads do not clear that stop. It checks local lease expiry conservatively; synchronized clocks and matching timestamp serialization are compatibility prerequisites. SQL tests use a local injected bridge, not a live PostgREST connection, so actual HTTP/schema-cache delivery still needs separately authorized verification.

PostgREST supports selecting columns as text with `::text`; see [official casting documentation](https://docs.postgrest.org/en/v14/references/api/tables_views.html#casting-columns). This avoids decoding a bigint revision through JavaScript Number. The adapter accepts only exact decimal strings; it does not silently coerce legacy numeric metadata.

## Source writer inventory

The [machine-readable inventory](creator-writer-source-inventory.json) records **90 remote heads, 71 matching source blob variants and 49 paths**, captured at exact commits. No branch was merged. It covers runtime source, workflow files, package hooks and relevant SQL, with explicit Creator/indexed-origin workflow enumeration. This is a source snapshot, not proof of enabled workflows, deployments, external scripts or currently executing writers. Removed refs and deployed historical commits still require operational reconciliation.

| Entry or writer | Source finding | Cutover consequence |
|---|---|---|
| `creator-worker-run.mjs` → legacy store/tick | One runner blob across 23 heads. Calls ignore-duplicates enqueue, then one tick. Old store blob `368a4db573…` is on 22 heads; reviewed client blob `0092734840…` is on the recovery head. | Drain every old entry point. RPC revocation alone does not stop enqueue attempts or privileged direct writes. No automatic job creation in the prepared V2 adapter. |
| Historical worker workflow, blob `2ebf0e5305…` | 29 heads including main; checkout explicitly targets mutable `feature/creator-history-worker-500`. | Updating recovery/main code alone does not replace that selected worker source. Review checkout target as part of a separately approved runner integration. |
| Historical worker workflow, blob `f5f4244fcd…` | 23 heads including assessment, Creator branch and recovery; selected-ref checkout with indexed origin opt-in. | Manual runs from older refs also need draining/prevention. Both variants use hourly minute 23/manual triggers, `glitch-creator-history` concurrency, no cancellation of running work. |
| Legacy tick variants | Three tick blobs across 23 heads: legacy, strict-status fix, reviewed recovery. Older variants lack the current client deadline/uncertainty protections. | All old runners must be accounted for, even if they share the same RPC names and concurrency group. |
| `intelligenceVault.mjs` | Separate writes to attribution, investigation-checkpoint and creation-evidence storage/RPCs. | Not covered by job revisions. Do not conflate or migrate their records. |
| Preview seed, resume and persistence scripts | Explicit Preview/branch/opt-in gates; seed writes attribution, resume writes the older investigation checkpoint, persistence writes creation evidence. Build validation contains the persistence helper but remains not opted in on recovery. | Inventory adjacent writers; leave their flags/configuration unchanged. They are not a V2 migration path. |
| Creator API/read bridge/dashboard | Read-only storage projection, cached evidence and provider observations; no direct durable job write located in these paths. | Preserve existing identity/freshness withholding; no new UI/score activation. |
| Private evidence retention/upload helpers | Separate object-storage upload/readback and signed-upload coordination, including an older injectable upload transport. | Not job-store adapters and outside this migration. No issuer, capture or storage activation. |

Workflow inventory also found these distinct families (including older variants):

- `glitch-creator-buy-readonly-diagnostic`, `glitch-creator-origin-diagnostic`, `glitch-indexed-origin-diagnostic`: manual provider reads; some main variants explicitly check out the older Creator branch. They are not job checkpoint writers; do not dispatch them for migration validation.
- `creator-alchemy-archive-capability`, `creator-historical-fee-probe`: manual/development-branch path-filtered push probes. They can contact providers and must not be mistaken for offline tests; this recovery-branch publication does not match those push filters.
- `creator-global-restricted-capture`: manual, separate concurrency/environment; its provider capture step is statically false in retained source. Runtime protections/permissions are not established by source inspection.
- `glitch-creator-worker-tests`: development-branch/manual synthetic tests; may generate/push a missing lockfile on that branch. It was not dispatched.
- `creator-token2022-regression`: development-branch/manual offline regressions; three retained variants.
- `creator-postgres-replay-test`: disposable signed-upload claim tests, separate from job fencing. Its synthetic claim table is not the Creator job table.

## Proposed coordinated sequence, requiring explicit approval

1. Parent reviews the exact migration and prepared adapter plus the separately prepared inactive runner integration. Confirm catalog drift, endpoint/schema-cache compatibility, clock alignment, payload limits and error reporting. Review all active/queued runs, deployed versions and direct writers against the source inventory. Do not activate the adapter merely because its tests pass.
2. Obtain approval for a **Creator-job-only maintenance pause and permission/schema cutover**. No pause, scheduling edit or credential change is performed here. Prevent manual/queued/scheduled old runner entry; drain active workers and database statements; verify all relevant leases inactive using database wall time. Workflow concurrency alone is insufficient.
3. Record existing job identities, stages/statuses, exact checkpoint hashes/sizes, request counters and lease metadata read-only. Stop if a prior write outcome is uncertain. Do not reset checkpoints or replay history.
4. In one separately reviewed migration transaction, add revision, install/restrict V2 RPCs and revoke old RPC execution. Confirm preservation of every preexisting field and that old calls fail closed. The checked-in SQL cannot run on hosted storage because of its disposable guard; prepare a distinct approved migration artifact rather than removing that guard ad hoc.
5. Deliver the reviewed V2 runner integration while execution remains disabled. It must read existing jobs, consume every returned revision, preserve paid-lookup reservations, respect existing request/duration ceilings, and stop on uncertain outcomes. No automatic enqueue, legacy fallback, retry or renewal. A read-only compatibility check does not authorize a historical tick.
6. Any bounded live validation and any resumption of the existing schedule require their applicable explicit approval and fresh prerequisites. This packet supplies neither a live budget nor permission to resume the known historical job.

## Rollback and stop conditions

Before commit, roll back the migration transaction. After commit, prefer fail-stop: keep execution disabled, preserve revision/checkpoint/counter history, and reconcile before another change. Never drop/reset revisions or automatically restore legacy RPC access. Re-enabling old writers would restore the reproduced race and needs separate review/approval after all V2 work drains. Source rollback cannot undo hosted writes.

Stop for unexpected catalog/row drift, active writers, uncertain outcomes, malformed/expired metadata, mismatched claim readback, unavailable V2 endpoints or incorrect permission checks. No additional infrastructure, credential scope or recurring scan is proposed. CI-14/15, authentic history, calibration and release remain open.

## Offline verification

Passed: 61 adapter tests, 71 disposable PostgreSQL checks and five adapter-to-local-SQL cases; 1,196 smoke tests, 83 retained Creator scripts, build/lint/type checks and 27 compiled mock-route cases. The database suites ran sequentially with a shared overlap lock. Production imports of the new adapter remain absent. No workflows or deployment configuration changed; existing recovery push checks remain offline. These results support preparation only, not CI-14/15 acceptance or authorization to apply the proposal.

## Inactive runner preparation

`lib/creatorIntelligenceRunnerV2.mjs` exposes a default-disabled function only. No workflow, CLI, route or environment flag invokes it. It uses the existing tick through a revision-aware V2 bridge, preserving existing reservation/evidence/retention semantics. Every running or final save consumes the preceding receipt revision; the claim readback is the adapter-validated checkpoint, not a second unverified snapshot. The path never enqueues, renews or falls back. It retains the 500-request, 90-second tick and 180-second lease ceilings. Provider transport failures stop later transport calls, including the legacy helper's HTTP-429 retry behavior, only in this prepared path.

Mock and isolated SQL tests exercise the actual tick, durable paid-lookup reservations, resume, all three uncertain-save boundaries, missing jobs, altered claim readbacks, expiry and request ceilings. A lost response after a locally committed reservation remains uncertain; a separately resumed synthetic expired job retains the reservation and does not repeat the paid lookup. This is not permission to retry any real uncertain job.

This integration can safely preserve Unknown while collecting explicitly authorized evidence later, but cannot make the exhausted historical job useful by itself. Authentic allocation/ownership and complete inventory remain blocked. There is no authorization or recommendation here to resume that job. Before cutover, parent must review this integration and the operational packet; a future deployment entry point and any live validation still require separate approval.

The inactive runner's no-retry guard includes body parsing and immediate abort notification. Focused baseline tests reproduced a second transport call after malformed JSON or late body failure on 2ab7a68; the correction blocks both and late headers. Reuse of the ordinary tick does not imply reuse of its automatic provider retry behavior in the V2 path. CI-06–08 issuer/caller trust decisions are separately recorded in the existing tracker and are not part of the job-fencing migration.
