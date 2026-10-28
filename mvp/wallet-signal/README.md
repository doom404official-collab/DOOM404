# DOOM404 Wallet Signal

Version: v0.1

DOOM404 Wallet Signal is an experimental Solana wallet analytics prototype.

## MVP

Input:
- Public Solana wallet address

Analysis:
- Latest 100 transactions
- Basic wallet/account information

Signals:
- Activity
- Diversification
- Trading
- Maturity

## Principles

- Explainable signals
- Public blockchain data only
- No wallet connection required
- No private keys
- No transaction signing
- No smart contract required
- No "safe", "scam", or investment verdicts

## Status

MVP development started.

## Liquidity offline evidence review — October 28, 2026

The canonical LQ-01–LQ-15 acceptance tracker remains [Issue #55](https://github.com/doom404official-collab/DOOM404/issues/55); there is no separate repository Liquidity checklist. This implementation note does not change its acceptance boxes or the consolidated Issue #66. Metadata updates remain parent-owned.

The LQ-09 offline slice adds requested-signature/slot and explicit execution proof before the historical investigator/replay decoder records new evidence. Missing or unsupported transaction/instruction evidence stays unresolved, including unavailable inner-instruction records; recognized failed transactions yield no settled candidates. New candidate observations carry deterministic outer/inner instruction identities. Existing checkpoint events and the retained 87-signature/60-signature artifact lineage are not rewritten or fetched. Unknown Solana error variants stay unverified using the existing strict error-form validator.

The transaction-evidence API now gates decoding on matching identity/execution and reports positively identified failure separately from unavailable proof. Historical fee recipient matching is retained as `recipientEligible` / `recipientEligibilityVerified`, not `authorizationVerified`: this helper has no independently established execution, account-role or destination proof. Missing recipient/state/identity, unsupported fee operations and conflicting observations at one instruction index remain Unknown; exact duplicate observations count once. No weights, thresholds, withdrawal classification policy or numerical scoring changed.

Verification commands (outbound blocked except explicitly mocked transport): `node --test tests/liquidity*.test.mjs` (272 passed); `npm run build` (1,447 smoke tests plus build/lint/type checks); `node scripts/check-liquidity-transaction-proof-route.mjs` (7 actual compiled-route cases through SDK JSON-RPC parsing); existing compiled evidence-route check (27 passed). The initial route harness omitted SDK-required `memo` in synthetic signature responses; correcting the mock resolved its 503 without a product workaround. Persistence remains `SKIPPED_NOT_OPTED_IN`.

Implemented is not accepted: LQ-08 history and LQ-09 authentic slot-matched state/owner/schema/roles/destination gates remain open. No live RPC, hosted writes, dispatch, schedules, credentials or production activation occurred. Next review should reconcile LP/vault ownership and withdrawal evidence boundaries under the retained methodology, without inferring authority from amount reconciliation. Creator remains paused.

### LQ-10 offline custody and fee/removal boundaries

LP holder observations now quarantine conflicting balances/owners for one token account rather than selecting the first row. Conflicting totals remain Unknown, inventories exceeding mint supply cannot be complete, and raw SPL amounts must fit u64. The LP-holder API reuses the token-account owner-program/mint/state validator. The withdrawal-capability summary consumes the actual `inventoryComplete` field, but still does not establish custody, locks, burns or redeemable amounts.

Vault deltas now require explicit successful execution, unique account/balance identity, canonical exact amounts and matching nonempty pre/post mint identities. Missing, conflicting or mint-mismatched balances yield no numeric delta. Fee-transfer decoding reuses requested-signature/slot/execution proof, checks the actual outer fee parent and mint/program/account layout, and retains distinct inner positions. Multiple legitimate token transfers under one outer fee claim can reconcile arithmetically; identical repeated observations count once and conflicting positions stay Unknown. Nested fee-claim role mapping remains unsupported rather than inventing authority from a shared outer index. Amount reconciliation remains an observation: authorization, settlement verification and withdrawal confirmation stay false.

Validation: 322 focused Liquidity/Pump AMM tests and 1,483 full smoke tests; build/lint/type checks; eight compiled transaction-route, four compiled LP-holder-route and 27 existing compiled evidence-route no-network cases. The compiled positive fee case uses the actual SDK parser and API pipeline with synthetic transport. Commands: the preceding LQ-09 commands plus `node --test tests/liquidity*.test.mjs tests/pump-amm*.test.mjs` and `node scripts/check-liquidity-lp-holder-route.mjs`. Persistence stayed `SKIPPED_NOT_OPTED_IN`.

LQ-10 is not accepted from these tests. Authentic historical pool/vault/LP ownership, signer/control rights, custody/lock/burn evidence and actual executed removal proof remain unavailable. No new withdrawal-positive classifier, scoring rule, historical rewrite or live operation was introduced. Issue #55 remains the canonical tracker; parent reviews and owns its updates. Next safe review: LQ-11 evidence-to-score/Unknown propagation under the existing methodology, after independent acceptance of this slice.

### LQ-11 offline score withholding and observation freshness

The approved Liquidity formula, weights and thresholds are unchanged. Complete synthetic formula inputs remain uncalibrated, while partial inputs cannot produce a final score. Dashboard/API diagnostics cannot supply missing verified components. LP `inventoryComplete` means the caller reported enumeration complete; it does not imply `supplyReconciled`, custody, redeemable LP or scoring eligibility when observed holdings are below supply. Tests preserve that distinction rather than changing policy.

Provider pool observations now deduplicate exact normalized repeats and quarantine conflicting observations for one pool, independent of input order. Any conflicting pool withholds the aggregate estimate. Dashboard observations require the matching mint, allowed status and existing one-hour freshness boundary. They remain provider-reported estimates, never executable-depth or custody proof. Refreshes clear prior estimates; request generations, cancellation through body parsing, timeouts and unmount/reset guards prevent older success or failure from restoring stale state.

Validation: 346 focused tests; 1,492 full smoke tests plus production build/lint/type checks; five new compiled reported-liquidity cases, eight transaction-proof cases, four LP-holder cases and 27 existing evidence-route cases. The actual-page mock browser harness passed 28 checks across 390px/1280px viewports, including fresh estimates, failure clearing and stale withholding. Commands: `node --test tests/liquidity*.test.mjs tests/pool-evidence.test.mjs tests/dashboard*.test.mjs tests/glitch*.test.mjs`, `npm run build`, `node scripts/check-liquidity-reported-route.mjs`, existing compiled route harnesses above, and `node scripts/check-holder-page-browser.mjs` against an outbound-blocked local build. Browser captures remain local review artifacts, not authentic chain evidence. Persistence stayed `SKIPPED_NOT_OPTED_IN`.

LQ-11 remains open for authentic evidence and calibration acceptance. No fallback score, policy change, historical checkpoint mutation or live operation occurred. The retained 87-signature checkpoint and 60-signature predecessor are unchanged. Issue #55/#66 updates remain parent-owned. Next safe review is LQ-12 presentation/acceptance after independent review of this slice.

### LQ-12 offline presentation audit

Liquidity estimates now expire at the existing one-hour freshness boundary without requiring polling or interaction; returning to a visible tab also rechecks freshness. Missing amounts display Unknown rather than zero. The existing black/red layout and four attribute navigation buttons remain unchanged. A keyboard-accessible observation disclosure shows provider provenance and timestamp, partial account-check counts/failures, explicit Unknown historical coverage, and bounded supporting pool links. Links are constructed from validated address syntax, never provider-supplied URLs. Records retained after expiry are labeled provenance only, not current verified reserves or custody. No historical progress percentage is invented from account checks.

Validation: 1,492 smoke tests and production build/lint/type checks. The existing actual-page harness extends 28 to 32 checks across mobile/desktop, adding keyboard disclosure and mint-edit clearing. The isolated real-component browser harness adds eight Liquidity cases per viewport: timestamp/provenance and keyboard drill-down, expiry without parent polling, numeric zero, loading, failure, conflicts, partial counts and failed-checkpoint withholding. Both browser harnesses block external requests. LQ-11 controller cancellation/body-timeout/navigation regressions are reused in the full suite; the 44 compiled API cases from 5503103 remain applicable because this slice changes no API or decoder. Persistence remains `SKIPPED_NOT_OPTED_IN`.

This is offline presentation evidence, not full release acceptance or authentic history validation. Owner/device UX acceptance, verified reserves/custody/withdrawal history and calibrated scoring remain gated. No provider calls, hosted changes, activation, schedule changes or metadata writes occurred. Canonical acceptance remains in Issue #55; the next safe slice requires parent review first.
