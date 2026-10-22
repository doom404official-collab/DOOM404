# CREATOR INTELLIGENCE — MASTER ACCEPTANCE TRACKER
Updated: 2026-10-22. Branch: feature/creator-history-worker-500.
Single source of truth. Do not infer completion from code existence, synthetic tests, or build status alone.

## Rules
- State: DONE only with linked evidence and acceptance checks; PARTIAL, BLOCKED, TODO otherwise.
- One active blocker at a time. Avoid duplicate implementations. Never retry a blocked write unchanged.
- Percentage is a planning estimate (~70%) and stays fixed until a substantive evidence gate closes.
- No automatic scoring/ledger promotion, main merge, production deployment, or broad worker activation without explicit separate approval.
- Each subsequent update: milestone ID, prior state, new evidence, new state, next action.

## Phase A — Historical Global fee verification
- [x] CI-01 Existing archive probe, pinned Global schema, decoder, offline verifier and capture scripts located. Evidence: creator-alchemy-archive-capability-probe.mjs; pumpFunPinnedGlobalDecoder.mjs; verify-historical-global-evidence-local.mjs.
- [x] CI-02 Manual protected workflow created, branch-restricted and credential-bearing step disabled. Evidence: .github/workflows/creator-global-restricted-capture.yml.
- [x] CI-03 Supabase private bucket created; storage objects/buckets RLS on, no public object policies observed. Bucket: creator-historical-evidence. Security caveat: service role bypasses RLS.
- [x] CI-04 Offline retention preflight and negative tests committed. Evidence: lib/creatorHistoricalRetentionPreflight.mjs; tests/creator-historical-retention-preflight.test.mjs. CI run result must be verified separately.
- [ ] CI-05 Confirm exact GitHub environment protection is saved, secret exact name and Alchemy archival entitlement. UI screenshots show branch restriction and repository secret name truncated; no direct environment API confirmation.
- [ ] CI-06 PARTIAL: private retention transport-injected helper committed (d797615), three negative no-I/O tests committed (d25d63c), CI registered (639b5a2). Mocked positive and readback-mismatch transport tests now committed (7e5063d), CI registration (d881d7b). Supabase transport added (1bce138), five mocked transport tests (ff448e7), CI registered (d672bd1). GitHub Actions Creator Token-2022 regression run #21 passed at 9204ea8 (user-provided run-history screenshot; run URL/logs not independently retrieved). Vercel Preview READY at 9204ea8. Exact project/object restrictions committed at 4220b16, fixtures repaired at 9204ea8. Remaining: independently inspect run #21 job logs, complete transport credential/security review, and end-to-end verified historical evidence readback. Security decision: service-role key is broad privilege and must not be described as bucket-scoped merely because transport hardcodes the bucket. Do not enable credential-bearing workflow until explicit secret scope and access review. Do not mark DONE before these pass.
- [ ] CI-07 Establish key scope, retention policy, object access audit and encryption expectations. Security design decision: prefer short-lived object-specific signed upload authorization from a trusted server component over passing the broad Supabase service-role key into GitHub Actions; independently authorize readback and enforce no-overwrite. Supabase documentation confirms service-role bypasses Storage RLS. Offline policy module committed (8cc95f8), seven adversarial tests committed (69e5a2d), regression workflow registration independently confirmed by reading current workflow. This does not issue signed tokens, authenticate callers, or persist replay state. No credential or storage policy changes yet. Never print secrets or upload raw evidence publicly.
- [ ] CI-08 Integrate secure retention with manual workflow and validate exact-head CI. Keep capture step disabled until all gates pass.
- [ ] CI-09 One bounded archive capture, preserve raw bytes, verify historical request provenance, owner, discriminator, length and SHA-256. No claim yet.
- [ ] CI-10 Prove pinned IDL layout applied at historical slot; decode candidate recipients and reconcile protocol/creator SOL destinations with transaction instructions.

## Phase B — Creator acquisition and behavioral accuracy
- [ ] CI-11 Independently verify live legacy and Token-2022 purchase settlement and acquisition ledger with actual historical ownership and fee paths.
- [ ] CI-12 Prove creator-linked initial allocation, current holdings, sales, transfers and attribution with complete evidence windows.
- [ ] CI-13 Verify previous launch histories and outcomes across supported launchpads; document unsupported cases.

## Phase C — Reliability, scoring and release
- [ ] CI-14 Prove worker scheduling, bounded budgets, leases, checkpoint recovery, no truncation, archival completeness and error recovery in live evidence.
- [ ] CI-15 Verify Supabase persisted jobs/checkpoints and exact dashboard identity/freshness on Preview, without fabricating scores.
- [ ] CI-16 Complete scoring calibration, false-positive/adversarial validation, and fail-closed unknown states.
- [ ] CI-17 Reconcile outstanding development PRs, exact-head CI, Preview acceptance, security review and rollback plan.
- [ ] CI-18 Obtain separate explicit authorization before any main merge, production go-live, or scoring activation.

## Immediate next action
CI-07 next: independently verify CI run, design trusted signed-token issuer and replay protection, then test restricted readback. Do not activate capture or store real evidence until security and retention acceptance. No new code unless a specific defect is found. No capture activation. Do not dispatch capture or change score.
