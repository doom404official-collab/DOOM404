# WP-02 creator qualification evidence

Status: **Implemented; live qualification remains partial.** Passing fixture tests do not establish live decoder coverage or explain every creator balance.

## Root causes and corrections

| Defect | Evidence and corrective action | Verification |
|---|---|---|
| Repeated nine processed signatures | Previous worker selected eight combined wallet/holder transactions plus creation. It paged unrelated creator-wallet history rather than the token account. Current worker retrieves a bounded twelve-full-transaction token-account page, decodes those directly, and retains the separate holder window. | Regression recovers at least thirteen unique transactions including creation, without duplicate per-signature RPC. |
| Pagination never resumed | Indexed request/response contract uses `paginationToken`. Previous code retained `paginationKey` without resuming it. New checkpoint binds mint, creator and verified token account, resumes the official token, and detects repeated/cycling cursors. Missing cursor metadata does not prove exhaustion. | Cursor, wrong-token, stalled-cursor and missing-metadata fixtures. |
| Current zero accounts concealed closed history | Creation-transaction token accounts are eligible history targets even when the current inventory is empty. Unknown closed accounts outside that transaction remain undiscovered. | Closed creation-account fixture. |
| Repeated immutable retrieval | Validated transaction-local creation proof uses bounded process-local single-flight/cache. Existing observation JSON privately retains creation plus up to three recent successful transactions for reuse across worker passes. | Clone isolation, cross-token/creator rejection, capacity and private-projection fixtures. |
| Incomplete and misleading accounting | Raw BigInt movements are classified by existing proof-gated event producers, deduplicated, and compared only with verified boundaries. No inferred zero opening balance. No zero recovered event is an inactivity claim. | Above-safe-number arithmetic, partial-window, conflicting-instruction and current-balance-only fixtures. |
| Current balance/accounting dropped during report merge | Fresh verified worker wallet inventory and bounded sanitized accounting diagnostic survive the dashboard evidence bridge. Diagnostics add no history scoring credit. | Bridge regression tests. |
| Negative creator discovery suppressed recovery | Current-creator unsupported/unavailable cache expires after three seconds; successful current-balance freshness remains sixty seconds. Independent Vault/store reads run concurrently. Successful immutable creation proofs cache separately from dynamic holdings. | Source and focused regression validation; live timing pending. |
| LaunchLab creation variants unrecognized | Strict pinned SDK layouts added for legacy initialize and Token-2022 initialize; original mint initialization is mandatory. Token creator, payer, initial authority and allocation recipient remain separate roles. | Installed Raydium SDK layout fixtures. New variants still require complete live proof validation. |

## Evidence contracts and limits

The Alchemy primary API contract documents `paginationToken`, full transaction retrieval, ascending order and token-account address history: https://www.alchemy.com/docs/chains/solana/solana-api-endpoints/get-transactions-for-address . Contract checked during this investigation. LaunchLab account layouts were checked against installed `@raydium-io/raydium-sdk-v2` 0.2.87-alpha source `src/raydium/launchpad/instrument.ts` (legacy initialize, initializeV2, initializeWithToken2022).

The existing eighteen-logical-request worker limit is preserved. Maximum normal planned work is seventeen: one origin page, three holder snapshot/classification reads, three holder histories, one current creator inventory, one token-specific indexed page, eight holder transaction reads. Actual use is lower with cached origin/transactions or exhausted windows. No additional paid provider, schema, quota or security-control change was introduced. Cache entries contain no credentials. Private raw transaction receipts are removed from public investigation responses. Traces use fixed phase names without wallet/token identifiers.

Attribution supports strict existing Pump.fun and Raydium LaunchLab transaction-local mechanisms. Unsupported launch mechanisms remain explicitly unsupported; metadata authority, fee payer, liquidity creator and treasury are not fallback creator identities. Sales/purchases require supported settlement evidence; unknown swap mechanisms remain unresolved rather than classified by transfer direction. Account-window exhaustion never implies lifetime completeness. Current balances refresh independently; immutable receipt reuse does not refresh dynamic evidence.

## Live acceptance still required

One existing connected-Alchemy PAID genesis `getTransaction` read was attempted. Its tool output was truncated at 8,098 characters, so it is not a complete independently verified transaction artifact. It cannot qualify a decoder. No successful live evidence is claimed from that response.

FLOAT's previously observed roughly 49.89 million acquisition/disposition remains unexplained by this work. The inherited evidence distinguishes an attributed wallet with one raw unit from a large self-authority token account; those identities must not be merged without proof. PAID reconciliation evidence remains preserved. New LaunchLab layouts, creator-history pagination against complete provider responses, and all mandatory token fixture histories require the integrated live matrix. Unknown closed accounts and unsupported settlement protocols remain documented scope limitations.

Physical Android acceptance remains with the owner. WP-02 must not be marked complete solely from the tests below.

## Regression receipts

- Nineteen new focused creator history/accounting/cache/layout tests passed.
- Combined risk-calibration and WP-02 focused suite: 31 passed, zero failed (`/tmp/wp02-final-focused.log`).
- Complete existing creator suite is recorded separately in `/tmp/wp02-creator-suite-final.log`.
- Integrated full regression/build/security/live matrix are owned by the coordinated release qualification pass.

## Modified scope

`lib/boundedTokenInvestigation.mjs`, `lib/boundedCreatorOriginV2.mjs`, `lib/launchLabCreatorOrigin.mjs`, `lib/creatorTokenHistoryV1.mjs`, `lib/creatorHistoryAccountingV1.mjs`, `lib/sharedCreatorOriginV1.mjs`, `app/api/current-creator/route.js`, narrow public projection changes in `app/api/token-investigation/route.js` and `lib/tokenInvestigationStore.mjs`, fresh creator/accounting projection in `lib/dashboardEvidenceBridge.mjs`, `tests/wp02-creator-token-history.test.mjs`, and the updated targeted-history status assertion in `tests/risk-calibration-v21.test.mjs`.
