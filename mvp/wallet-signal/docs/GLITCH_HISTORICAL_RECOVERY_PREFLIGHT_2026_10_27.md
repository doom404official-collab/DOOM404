# GLITCH historical recovery preflight — 2026-10-27

Status: HOLD — offline engineering only. This document does not authorize workflow dispatch, live RPC, checkpoint changes, scoring promotion, or deployment.

## Holder
Frozen mint: 98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump.
Two existing running-status jobs have expired leases:
- c670f393-31b0-470c-a01f-cb2b813a1219, version 2134, nextWalletIndex 18, 20 holders.
- d07c0256-b472-4089-a237-99ed5e5c8cc4, version 1812, nextWalletIndex 4, 20 holders.
Both have archiveCompletenessProven=false. Do not reset or merge their checkpoints.

The deployed tick API currently calls getNextRunnable(), which selects the oldest eligible job rather than a pinned job. Implement a separate explicitly pinned recovery path with an allowlisted job ID, mint and expected checkpoint version. Preserve the atomic claim, renewal and commit RPCs. Reject mismatches and concurrent claims fail-closed. Do not change the general scheduled worker's selection policy without a separate review.

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
