# GLITCH historical recovery preflight — 2026-10-27

Status: HOLD — offline engineering only. This document does not authorize workflow dispatch, live RPC, checkpoint changes, scoring promotion, or deployment.

## Holder
Frozen mint: 98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump.
Historical observations only (not fresh execution authority): two running-status jobs had expired leases:
- c670f393-31b0-470c-a01f-cb2b813a1219, version 2134, nextWalletIndex 18, 20 holders.
- d07c0256-b472-4089-a237-99ed5e5c8cc4, version 1812, nextWalletIndex 4, 20 holders.
Both have archiveCompletenessProven=false. Do not reset or merge their checkpoints.

The deployed tick API currently calls getNextRunnable(), which selects the oldest eligible job rather than a pinned job. Use the separately gated explicitly pinned recovery path described below with an allowlisted job ID, mint and expected checkpoint version. Preserve the atomic claim, renewal and commit RPCs. Reject mismatches and concurrent claims fail-closed. Do not change the general scheduled worker's selection policy without a separate review.

Offline acceptance:
1. Correct pinned job selects only that job.
2. Wrong job ID/mint/version returns an error before RPC.
3. Expired lease can be atomically claimed; active lease cannot.
4. Version conflict and failed renewal prevent checkpoint commit.
5. RPC budget is bounded and duplicate evidence does not increase counts.
6. No scoring promotion; snapshot and original checkpoint remain unchanged during tests.

## Creator
Current persisted job: stage selling, status partial, request_count_total 7189, creatorHistoryRpcExhausted=true, creatorHistoryComplete=false.
Current sellingStatus=AWAITING_VERIFIED_INITIAL_ALLOCATION. initialAllocationEvidence.status=INITIAL_ALLOCATION_INCOMPLETE, coverageComplete=false, initialAttributableRaw=null.
The selling stage consumes verifiedLaunchDistributions and launchDistributionCoverageComplete from checkpoint state; a producer for these inputs has not been verified. Do not infer zero allocation or set coverageComplete=true.

Offline acceptance:
1. Define instruction-level identity and deterministic deduplication contract for launch distributions.
2. Verify source provenance, mint, recipient, amount, timestamp/slot and launch-window membership.
3. Ensure replay/order invariance and reject conflicting same-signature evidence.
4. Preserve Unknown for incomplete archive and selling windows.
5. Verify producer-to-consumer integration against fixtures before a live run.

## Operational gates
Check GitHub workflow enabled state, final scheduled-run logs, Vercel preview commit and worker configuration, and Supabase snapshot/version before any approved bounded dispatch.
Liquidity LQ-08 remains offline-only. No recurring scheduling or production deployment is authorized.

## Holder H03 implementation evidence — 2026-10-27

Draft PR #74 remains offline-only. Consolidated `runPinnedHolderRecovery` replaces both V1 and V2; V2 and its exception-only “valid scan” test are removed. `POST /api/holder-scan-recovery` calls this adapter explicitly. It requires Preview, the recovery branch ref, the new `GLITCH_HOLDER_RECOVERY_ENABLED=true` opt-in, the existing worker-enabled flag and existing constant-time worker-token authentication. No flag or credential was changed. No workflow calls the new endpoint. No scheduler selection changes.

Only the two job IDs above and the frozen mint are accepted. Caller must supply a freshly reviewed expected version; historical 2134/1812 are fixture examples, not permission to execute. Each job retains its own checkpoint. Max 20 provider calls, no transport retry, lease 90–180 seconds (route fixes 90). Invalid dependencies/budgets, missing or inconsistent lease metadata, active leases, malformed engine state and non-false archive flags fail closed. `getById` now includes owner/expiry. Explicit wrapper methods preserve prototype-bound stores.

### Checkpoint and lease contract
- Read returns complete lease metadata and checkpoint; adapter clones it before any work.
- Existing SQL claim increments version **v → v+1** and is atomic on runnable status and null/expired lease. It has no expected-version argument. A concurrent change between read/claim can therefore acquire a lease, but exact post-claim job/mint/version/checkpoint comparison stops before provider RPC. No unsafe release/reset is attempted; let the short lease expire and obtain fresh authority. A schema-level compare-and-claim enhancement is outside this no-migration task.
- Worker scans a private checkpoint copy. Its existing round-robin cursors, checked/pending signatures, failed history, edges, network evidence and snapshot survive. No checkpoint combining, pruning or scoring promotion is added.
- Renewal checks owner, active expiry and exact version **v+1 → v+2**, with exact checkpoint equality; false or malformed renewal cannot commit. Provider requests stop once the observed lease expires; database time remains authoritative for renewal/commit.
- Commit uses **v+2 → v+3**, preserving pre-existing summary fields (including score/methodology). Response must match identity, version, status, released lease, checkpoint and summary. SQL no-match is VERSION_CONFLICT. Transport failure or malformed success is COMMIT_OUTCOME_UNKNOWN, reconciliationRequired=true, retryAllowed=false (HTTP 503). Inspect persisted job/version/checkpoint read-only before any further authorized attempt; this path does not auto-retry or infer rollback.
- A provider interruption can persist bounded progress through normal renewal/commit. Process termination before commit leaves prior persisted checkpoint intact; resume only after lease expiry with a fresh version. Lost commit responses may have persisted: never replay the old request.
- Existing worker status `complete` means provider-observed exhaustion only. `archiveCompletenessProven:false` is retained; no historical completeness or accepted score follows.

### Verification
- 61 focused offline tests: `node --test tests/holder-pinned-recovery.test.mjs tests/holder-recovery*.test.mjs tests/holder-job-store.test.mjs`.
- Actual history engine + realistic synthetic 20-holder checkpoint fixtures at separate cursor positions 18/4; actual REST store with mocked transport; prototype-bound store, both IDs, malformed metadata, race/concurrent claims, renewal loss/mismatch, stale commit, provider/process interruption, uncertain commits (persisted and not persisted), exact 20-call ceiling, duplicate decoded transfer replay and immutable prior history/snapshot/score.
- Existing disposable PostgreSQL suite: `PGHOST=127.0.0.1 PGDATABASE=glitch_controlled_merge_test PSQL=/tmp/holder-psql python3 tests/fixtures/holder-atomic-merge/run-disposable-tests.py`: **25 checks passed**. PostgreSQL 17 container with `--network none`; wrapper executes local container psql. Tests use checked-in claim/renew/commit SQL fixtures, concurrency/rollback/expired lease/stale worker/readback cases. This verifies fixture SQL, not deployed schema, credentials or hosted database permissions. No Supabase branch/project created.
- Final `NODE_OPTIONS=--require=/tmp/holder-offline-guard.cjs NEXT_TELEMETRY_DISABLED=1 npm run build`: **700/700 smoke tests passed**, Next build/lint/type phase passed, persistence helper SKIPPED_NOT_OPTED_IN. Guard blocks socket connects and default global fetch. Installed dependencies reused (Node 24); not a fresh dependency-install test. Existing compiled evidence-route script passed **21 no-network cases**; compiled recovery handler returned disabled/503 with zero network. No standalone lint/type script is configured. `git diff --check` passed.

- Payload-size follow-up: parent read-only observation at 2026-10-27 08:58:24 UTC reported unchanged separate versions 2134/1812 and checkpoint sizes 8,275,819 / 7,559,667 bytes. Added an **8,242,958-byte synthetic fixture**, 13,000 retained transfers and 15,000 checked signatures: actual worker/adapter preserves the serialized prior network evidence, frozen snapshot, pending signature and score. Focused suite **61/61**; full outbound-guarded smoke rerun **701/701**. One local size test took ~433 ms; this is not a Vercel memory/latency guarantee. Production code is identical to the successful 700-test build above.
- Parent separately inspected hosted claim/renew/commit read-only and corroborated the fixture's version advancement and non-CAS claim contract. This engineering task did not execute hosted functions; authorization and fresh live prerequisites remain with parent.

### Branch reconciliation
Assessment already contains snapshot-validity, controlled-merge uncertain-outcome, reconciliation-provenance, strict-flags and disposable-PostgreSQL branch work (ancestor checks passed). No duplicate implementation or merge added. Separate `fix/holder-tick-identity` (4dd8478) improves ordinary tick observability; it is not integrated here. Dashboard-integration, concentration-scoring and workflow-syntax branches remain separate; their source was inventoried, not merged. Recovery does not modify ordinary tick selection or introduce competing merge/reconciliation logic.

### Workflow and trigger inventory
Source reviewed at recovery base 1207f4c8, assessment 58195222, main fe5b845b and all nine existing Holder branches. Source schedules below are not proof that workflows are currently enabled. No dispatch/schedule edit occurred.

- Assessment/recovery `glitch-holder-worker-auto`: hourly minute 17; manual worker shares `glitch-holder-investigation`, cancel-in-progress=false. Both call ordinary tick; automatic can start a missing job. Recovery never does.
- Main `glitch-holder-worker-controlled-test`: minute 5,17,29,41,53; four bounded ordinary ticks declared in source; `glitch-holder-investigation`. **The older owner approval covered two ticks only. Source configuration does not extend that authority to four ticks. Do not dispatch this workflow under the older two-tick approval; separate reconciliation/approval is required.** Main “auto” is manual-only; main manual-worker YAML lacks that concurrency group (assessment copy has it). Cross-source discrepancy retained, not silently edited.
- Main `glitch-controlled-network-merge`: manual, same holder concurrency group, three verified signatures via atomic claim/commit; no provider RPC. Existing reconciliation and frozen-cross-job tools are read-only/provenance-guarded; they are not substitutes for fresh pinned recovery authority.
- Evidence validation: assessment `glitch-evidence-worker`, main `glitch-evidence-validation-manual`, every 30 minutes, separate `glitch-evidence-validation` group. Per-job/signature evidence leases are separate from the scan-job lease. This group does not serialize against recovery; atomic scan claim/renew/commit remains required.
- History artifact scanner: manual, no workflow concurrency group; up to two 65-request batches, separate artifact checkpoint. Not the 20-call database recovery path; never used here.
- Read-only diagnostics and snapshot/assessment writers are also inventoried below; “manual” does not mean harmless and none was invoked.

Read-only run metadata: latest 100 runs returned no newer Holder scheduled run than **39752751653** (2026-10-22): successful, one partial tick with 20 requests, then idle; final running, 11,540 checked, 2,862 pending, 6 exhausted wallets, historyComplete=false. Evidence run **39748276525** successful: six requests/claims/processed, zero lease loss. These are historical logs, not fresh checkpoint or lease authority. Workflow enabled-state listing was unavailable: connector rejected `/actions/workflows` as unsupported; `gh api` returned Forbidden. Neither executed a mutation. Do not infer disabled schedules from missing newer runs.

Publication safety: normal PR runs for the recovery base were 40451488620 (Scanner checks), 40451488550 (Evidence validation tests), 40451488526 (Sprint 1), all success. Source runs offline tests/build and disposable Postgres only. Branch-specific live push workflows do not match the recovery branch. Build persistence helper requires a different Creator branch and is skipped here. No vercel.json cron/config was found; all API handlers are request-driven. New recovery endpoint defaults disabled and no existing workflow targets it. Both projects previously reported Preview Ready on PR #74; exact new-commit statuses must be checked after publication. No production promotion, Preview API invocation or hosted writes authorized.

| Source | Workflow | Trigger / concurrency declaration |
|---|---|---|
| assessment/recovery | `glitch-diab-cpi-readonly.yml` | workflow_dispatch: |
| assessment/recovery | `glitch-evidence-validation-tests.yml` | workflow_dispatch:; pull_request:; push: |
| assessment/recovery | `glitch-evidence-worker.yml` | workflow_dispatch:; schedule:; - cron: '*/30 * * * *'; group: glitch-evidence-validation |
| assessment/recovery | `glitch-holder-assessment-tests.yml` | workflow_dispatch:; push: |
| assessment/recovery | `glitch-holder-history-checkpoint.yml` | workflow_dispatch: |
| assessment/recovery | `glitch-holder-worker-auto.yml` | workflow_dispatch:; schedule:; - cron: '17 * * * *'; group: glitch-holder-investigation |
| assessment/recovery | `glitch-holder-worker-manual.yml` | workflow_dispatch:; group: glitch-holder-investigation |
| assessment/recovery | `glitch-liquidity-evidence-worker.yml` | workflow_dispatch:; group: glitch-liquidity-evidence-${{ inputs.mint }} |
| main | `glitch-controlled-network-merge.yml` | workflow_dispatch:; group: glitch-holder-investigation |
| main | `glitch-diab-cpi-readonly.yml` | workflow_dispatch: |
| main | `glitch-diab-vault-observation.yml` | workflow_dispatch: |
| main | `glitch-evidence-validation-manual.yml` | workflow_dispatch:; schedule:; - cron: "*/30 * * * *"; group: glitch-evidence-validation |
| main | `glitch-frozen-cross-job-readonly.yml` | workflow_dispatch: |
| main | `glitch-holder-assessment-readonly.yml` | workflow_dispatch: |
| main | `glitch-holder-h06-alchemy.yml` | workflow_dispatch:; group: glitch-holder-h06-alchemy-readonly |
| main | `glitch-holder-h06-counterpart-roles.yml` | workflow_dispatch: |
| main | `glitch-holder-h06-pump-operation.yml` | workflow_dispatch: |
| main | `glitch-holder-h06-sensitivity.yml` | workflow_dispatch: |
| main | `glitch-holder-h06-vault-history.yml` | workflow_dispatch:; group: glitch-h06-vault-readonly |
| main | `glitch-holder-history-checkpoint.yml` | workflow_dispatch: |
| main | `glitch-holder-worker-auto.yml` | workflow_dispatch:; group: glitch-holder-investigation |
| main | `glitch-holder-worker-controlled-test.yml` | workflow_dispatch:; schedule:; - cron: '5,17,29,41,53 * * * *'; group: glitch-holder-investigation |
| main | `glitch-holder-worker-manual.yml` | workflow_dispatch: |
| main | `glitch-liquidity-evidence-worker.yml` | workflow_dispatch:; group: glitch-liquidity-evidence-${{ inputs.mint }} |
| main | `helius-historical-throughput.yml` | workflow_dispatch:; group: helius-live-diagnostic |
| main | `helius-low-impact-diagnostic.yml` | workflow_dispatch:; group: helius-low-impact-diagnostic |
| main | `helius-staged-concurrency.yml` | workflow_dispatch:; group: helius-live-diagnostic |
| main | `holder-concentration-live-assessment.yml` | workflow_dispatch: |
| main | `holder-network-live-diagnostic.yml` | workflow_dispatch: |
| main | `holder-snapshot-rpc-diagnostic.yml` | workflow_dispatch: |
| main | `shared-rpc-capacity-diagnostic.yml` | workflow_dispatch: |
| main | `top20-consolidated-assessment.yml` | workflow_dispatch: |
| main | `top20-single-run.yml` | workflow_dispatch:; group: top20-${{ inputs.snapshot_id }} |
| main | `top20-snapshot-write-read.yml` | workflow_dispatch: |
| main | `top20-vault-connection.yml` | workflow_dispatch: |

### Remaining H03 acceptance / proposed Issue #66 delta
H03 remains IN_PROGRESS; Holder remains **4/11** accepted. Draft pinned recovery now has offline worker/store/lease coverage and disposable SQL evidence, but neither live job is complete or has an approved bounded cutoff. Owner authorization, fresh separate checkpoints/versions/leases, actual deployed SQL/Preview configuration, workflow enabled-state/concurrency and provider budget must be verified before any bounded live attempt. H04/H05 historical coverage/ownership, H08 retain-19-versus-versioned-replacement decision, H09 calibration/promotion, H10 dashboard acceptance and H11 release remain open/gated. H06 infrastructure classification only and H07 accepted observations remain unchanged; no repeat RPC.

## Independent-review follow-up: elapsed budget and retained schema

The recovery route still has maxDuration=60. A recovery-only monotonic budget now starts at POST entry, including input parsing: stop provider work at **30 seconds**, retain **20 seconds for renewal/commit/serialization**, and stop network operations by **50 seconds**, leaving a **10-second platform/CPU margin**. Each input/store/provider operation has an **8-second maximum**, shortened by its remaining phase budget. Slow preflight/read/claim consumes provider time rather than extending the execution. Provider pacing and response-body consumption share the cancellation signal. Store read/claim/renew/commit forward the signal through the actual REST adapter; the budget also races the full operation so a hung transport/body cannot prevent timeout handling. General worker selection, ordinary store callers without signals, schedules, 20-call cap and 90–180-second lease bounds remain unchanged.

A provider timeout stops scanning and permits persistence of prior completed work using the reserved time. A late provider result is discarded and cannot mutate the worker checkpoint. A read timeout stops before claim; claim/renewal timeouts return explicit unknown outcome with reconciliationRequired=true and retryAllowed=false. Renewal timeout never starts commit. Commit timeout remains COMMIT_OUTCOME_UNKNOWN even when the server already persisted. Abort is not proof of database rollback; no timed-out mutation is retried automatically. JavaScript deadlines cannot preempt synchronous CPU work or a stalled event loop; post-operation deadline checks reject late values, but the safety margin is not a guarantee against platform termination or unbounded CPU starvation. Interrupted persistence still requires read-only reconciliation.

Preflight now requires checkpoint.version=1. Existing network evidence must have version 1, object processed records, an array of transfers, retentionLimited=false, a matching exact identity from the shared existing holderNetworkSnapshotIdentity serializer, coherent per-signature retained transfer counts and checked states, and available retention capacity. Unsupported/malformed/mismatched evidence fails **before claim**, unchanged. No evidence migration/reset or inferred archive completeness is permitted. Absent network evidence remains supported for legacy checkpoints that have not begun network extraction.

Legacy holders may omit amountRaw and the checkpoint may omit snapshot. The shared serializer preserves omitted holder properties and the existing null snapshot identity convention; recovery does not fabricate raw balances or supply. Parent read-only inspection reported matching retained legacy identities, version-1 schemas, retentionLimited=false, and 16,610/14,977 transfers with 3,022/2,788 processed signatures respectively. This report does not replace fresh preflight; any actual mismatch is a live blocker, not authority to repair hosted data.

Deterministic tests cover slow successful providers/stores, the 30s provider cutoff and 50s total cutoff, hung fetch and hung response bodies at every store stage, abort during pacing, no requests after budget, late response isolation, commit timeout before/after persistence, schema/version/shape/identity rejection, and valid omitted-raw-balance legacy identity. The large fixture now includes coherent processed counts: **8,368,477 bytes**, 9,500 transfers and 15,000 checked/processed signatures (synthetic, not live evidence).

H03 remains IN_PROGRESS, Holder 4/11; no live dispatch or schedule change. The four-versus-two tick authorization discrepancy is explicitly unresolved above.

Follow-up verification: **88/88 focused tests**, **728/728 full smoke tests** with the outbound guard, Next build/lint/type validation passed (723 tests at build time; five additional transport/pacing tests subsequently passed in the full rerun). Compiled evidence route: **21 no-network cases**; compiled recovery endpoint: default disabled/503, no network. `git diff --check` passed. No schema/SQL changes; the existing 25-check disposable PostgreSQL suite remains in normal PR CI.

## Parent operational review and H04 handoff — 2026-10-27
H03 offline engineering at 72d48c6 was independently reviewed; full H03 remains open. Parent's read-only Preview inspection confirmed READY, but no recovery opt-in entry or recovery-branch worker flag/token scope. No configuration was changed. Approved live use requires separate flag/token scope review, fresh job/lease/budget prerequisites and workflow enabled-state access; the main workflow's four ticks remain outside the older two-tick approval.

Subsequent H04 offline work uses the same branch and shared history engine. See the existing H04 section in [the master register](HOLDER_INTELLIGENCE_MASTER_CHECKLIST_2026_10_22.md) for discovery/decoding acceptance, new additive retry/cursor metadata and remaining authentic-history blockers. No H05 implementation or other attribute work was started.

## Sequential H05 handoff — 2026-10-27
Parent reviewed H04 engineering at c6f1d26 without accepting full history coverage. H05 now replaces snapshot-owner attribution with conservative transaction-local ownership and instruction identities; see the existing master register's H05 section for exact offline subgates and limits. Lifecycle ambiguity remains Unknown, legacy records are preserved, and the scorer is unchanged. H03/H04/H05 full acceptance remains open, Holder 4/11; H10 has not started.

Push/PR trigger review remains unchanged: Sprint validation, Scanner checks (including disposable PostgreSQL), and evidence tests run offline on PR changes. Live Holder/evidence schedules and manual workers are not push triggers for this branch. The build persistence helper requires a different Creator branch and explicit opt-in; the local outbound-guarded build reports SKIPPED_NOT_OPTED_IN. No workflow or configuration file changed. The recovery route remains default-disabled. Existing workflow inventory and the unresolved enabled-state access/four-versus-two tick approval discrepancy above still govern; no dispatch is authorized by publication.

H05 review follow-up centralizes version/instruction-entry validation in the shared decoder and distinguishes identified transaction failures from Unknown metadata in both evidence validators. See the existing register for exact error/identity contract and 841-test regression evidence. No live recovery, configuration or workflow change accompanies this correction.

## Sequential H08 offline handoff — 2026-10-27
H05 offline engineering was independently accepted at e694e8c; full H05 remains open. H08 reuses October 22 sensitivity/parity evidence and adds missing cross-job consistency/Unknown checks, frozen raw-input validation, explicit scenario eligible counts and direct-pair shape checks. The existing sensitivity script is guarded more strictly but was not run. No hosted read/write, RPC, history reset, exclusion promotion or policy choice occurred. Existing trigger inventory is unchanged; only ordinary offline PR tests/build and authorized Preview publication apply. The master register contains the 19-eligible-versus-versioned-replacement recommendation for owner decision and exact remaining blockers. Holder remains 4/11; H09/H10 have not started.

## Sequential H09 offline handoff and approved eligible view — 2026-10-27
Owner explicitly approved retain-19 at 10:16:40 UTC (`Sentinel_066b8879683c8191b27bf71130e93a9e`, replying to the scoped retain-19 request). The new pure eligible-view policy preserves the original frozen ranking/raw supply and excludes the accepted pool from the 19-entry view, with no replacement, historical rewrite or score computation. This resolves the H08 choice only, not history/calibration/promotion gates. H09 additionally tightens provenance boolean checks and computes original top-20 concentration from the raw aggregate before the existing conversion/formula. The master register records regression evidence and the unresolved mapping between original top-20 concentration and any future eligible-19 consolidated component. Existing schedules, budgets, live configuration and release restrictions remain unchanged; H10 has not started.

## H09 clarification and H10 offline presentation
The owner explicitly approved eligible-19 concentration and PR disclosure at 10:25:56 UTC (`Sentinel_77826a37be548191a0dd3d299d208769`). The scoped H09 component is committed separately and tested before H10 resumed; original-20 measurement and unchanged denominator/formula are retained. H10 updates only the existing Holder dashboard/map slices, with per-signature labels, Unknown handling, keyboard focus, provider state and distinct frozen20/eligible19 scope. Isolated real-component browser QA passed at mobile/desktop sizes with zero network requests; it is not live acceptance. Existing trigger inventory and live/configuration/release restrictions are unchanged.
