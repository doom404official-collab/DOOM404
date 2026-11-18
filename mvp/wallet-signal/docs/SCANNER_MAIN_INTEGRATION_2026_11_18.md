# Isolated Scanner integration candidate — blocked, local only

Base main: `a24e1411d0e3749b6e1029ff98855d72c1a68078`. Reviewed source recovery: `129bbf5b1803be285a3db3af6ca5b04d78d74e93`.
Branch: `integration/glitch-app-main-20261118`. No merge/rebase/cherry-pick; non-deleting app overlay. Recovery branch/PR74 untouched. This is not release or hosted acceptance.

## Preservation
All 16 main-only app paths remain byte-identical to main:
- `mvp/wallet-signal/lib/liquidityFailureDiagnostic.mjs`
- `mvp/wallet-signal/lib/liquidityPartialRecovery.mjs`
- `mvp/wallet-signal/public/animations/analysing.svg`
- `mvp/wallet-signal/public/animations/getting-ready.svg`
- `mvp/wallet-signal/public/animations/signal-ready.svg`
- `mvp/wallet-signal/scripts/liquidity-automatic-history-gate.mjs`
- `mvp/wallet-signal/scripts/liquidity-prepare-partial-recovery.mjs`
- `mvp/wallet-signal/scripts/liquidity-preserve-failure-diagnostic.mjs`
- `mvp/wallet-signal/scripts/liquidity-select-checkpoint.mjs`
- `mvp/wallet-signal/scripts/liquidity-validate-artifact-discovery.mjs`
- `mvp/wallet-signal/tests/liquidity-auto-worker-mocked-investigator.test.mjs`
- `mvp/wallet-signal/tests/liquidity-partial-recovery.test.mjs`
- `mvp/wallet-signal/tests/liquidity-pr46-failure-cli.test.mjs`
- `mvp/wallet-signal/tests/liquidity-pr46-workflow-contract.test.mjs`
- `mvp/wallet-signal/tests/liquidity-worker-checkpoint-selection.test.mjs`
- `mvp/wallet-signal/tests/liquidity-worker-offline-safety.test.mjs`

Every .github file remains byte-identical to main. No schedule, permissions, budgets, batch count, runtime activation or CI definition changed. No root site/Runner/RPC code changed. No pending SQL applied, checkpoints reset or held capability summary included. Existing reviewed recovery API routes are part of the app overlay and are new relative to main; no additional prepared Creator/Liquidity proposal route or workflow was activated. Existing SQL proposals remain unapplied. Existing source documentation is retained history, not a new acceptance claim.

## Deliberate shared-path resolutions
- app/page.js uses reviewed recovery Token Analysis default, five-tab dashboard, stale-response/body cancellation and retained Wallet surface/mascot. Main's separate animation SVG assets remain; main hover/click mascot presentation is not assumed visually equivalent. No new UI policy selected.
- liquidityAutoExecutionContract.mjs: preserve recovery's cloned immutable predecessor across await.
- liquidityAutoWorkerEvidenceGate.mjs: preserve successor/retained-history guard, no implicit promotion.
- liquidityAutomaticCheckpointSelector.mjs: preserve missing-state rejection, conflicting run-ID rejection and retained-history checking.
- liquidityAutomaticHistoryGate.mjs: preserve strict safe-integer counters.
- liquidityHistoricalDecoder.mjs: preserve signature/slot/execution/instruction proof and Unknown handling.
- liquidity-historical-investigator.mjs: preserve required continuation source, deadlines, interruption persistence, no reset, no overwrite, duplicate/cursor guards and request ceilings.
- liquidity-validate-successor.mjs: use stricter shared successor guard.
- liquidity-auto-execution-contract.test.mjs and liquidity-auto-worker-evidence.test.mjs: preserve recovery adversarial regressions.
The other 12 shared-changed app paths already have identical main/recovery blobs.

## Actual combined-tree validation
One `NODE_OPTIONS=--require=/tmp/ts-owner-offline-guard.cjs NEXT_TELEMETRY_DISABLED=1 npm run build` attempted with the already installed reviewed dependencies (temporary local symlink, not committed). Aggregate: **1,791 tests, 1,785 passed, 6 failed**. Production compilation/lint/types were NOT reached because the test gate stopped the command. No audit repeated. No hosted/provider calls.
Six failures are real integration evidence, not hidden or skipped:
1. Actual main manual Holder workflow lacks recovery's default-disabled exact-SHA/window dispatch contract; its source-contract test fails. Historical recovery runner tests pass, but they do not establish main workflow admission.
2. Actual main automatic Holder helper retries an uncertain POST three times; no-write-retry assertion fails. This is an actual behavior guard, not a historical fixture: do not repoint it to a snapshot to hide the problem.
3–6. Main's mocked investigator tests omit GLITCH_HISTORY_CHECKPOINT and assume from-zero output (empty-history, malformed page, 60-call ceiling and fallback ceiling). Reviewed continuation-only CLI rejects before RPC. Mock transport fixtures also need review against the current response-envelope contract. Do not re-enable restart-from-zero to pass them.
Retained main recovery/CLI tests other than those four passed in the aggregate. No files/tests were deleted or assertions weakened. Three pre-existing trailing blank-line diff warnings remain in imported recovery documentation/SQL fixtures; they do not explain failures.

## Stop boundary and exact next decision
No publication, draft PR, CI or Preview for this candidate: publication condition is not met.
A narrow follow-up needs permission to reconcile main's POST uncertainty behavior while retaining its manual-only trigger, two batches, five-minute timeout, permissions and budgets. That changes live workflow behavior and was expressly excluded from this step. Recovery manual dispatch must remain inactive unless separately authorized: decide whether to retain it solely as a version-pinned inactive proposal with truthful tests, or authorize its gated integration; do not silently activate it.
Independently, main's four old CLI mocks can be migrated to explicit synthetic continuation fixtures and current mock envelopes, retaining request/lineage/no-promotion assertions. Real historical checkpoints must not be used or rewritten. After those changes, repeat only affected tests and final build on the revised candidate. Protected merge, production and hosted activation remain separate approvals.
