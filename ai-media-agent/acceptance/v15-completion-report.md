# DOOM404 V15 intelligence engine completion report

25 November 2026. Preview only. V15 is not frozen or approved for production.

## Executive result

The shared classifier reconciles five genuine PumpSwap sales and two genuine routed Pump.fun sell_v2 transactions. Three genuine SPL burns validate separately from TOMO's incinerator transfer. The creator API consumes this classifier, and its consolidated evidence reaches the trader briefing without assigning unrelated trader sales to the creator. The browser research flow completed and produced a narrated 9:16 WebM with VP8 video and Opus audio.

Acceptance is limited to the executed fixture matrix below. Untested settlement variants remain rejected, and the limitations section is part of the handover.

## Implemented and executed

- Reused the supplied signatures before discovering additional evidence; saved 20 finalized raw transactions with expected classifications and canonical hashes.
- Extracted shared sale, burn, direct-transfer and fee-instruction modules. The creator API and sale endpoint use the same sale reconciliation function.
- Verified account initialization and authority, exact token and quote transfers, pool changes, WSOL account closure, native proceeds, rent refunds and transaction fees.
- Supported bounded nested instruction attribution. The two validated bonding-curve sales are routed instructions, with event evidence and a complete native-balance ledger.
- Retained separate creator identity, allocation, direct holdings, funding, transfers, recipient movements, sales, proceeds, burns, fee collections, prior launches and unresolved exposure fields.
- Added finalized fixture reuse, in-flight deduplication and a bounded 100-entry process cache. No new infrastructure or subscriptions were provisioned.
- Corrected the older narration contract that rejected V15 captions and bounded longer scene audio. Corrected the final-scene index and V15 export filename.

## Historical evidence

Full signatures, raw evidence and expected classifications are in `tests/fixtures/historical/index.json` and `expected.json`. References below identify those exact fixtures.

| Signature prefix | Executed result | Exact token amount | Reconciled proceeds |
| --- | --- | ---: | ---: |
| 479USJgwsJBr | PumpSwap sale | 1,223,452.638537 TOMO | 0.102876325 WSOL |
| 2X7h1c46CBgY | PumpSwap sale | 1,216,576.003669 TOMO | 0.102848858 WSOL |
| 5yajm5NADjKF | PumpSwap sale | 34,310.121934 TOMO | 0.002908568 WSOL |
| iKcwEz4GnwEZ | Temporary WSOL sale | 121,991.221887 TOMO | 0.010222138 SOL settled |
| 3BuMccVmHYnR | Temporary WSOL sale | 121,305.548356 TOMO | 0.010170111 SOL settled |
| 2gEsSGxrkbds | Routed Pump.fun sell_v2 | 2,264,707.626888 GCXb…qKVR | 0.082465063 SOL net |
| 5MCFPrm5nE8w | Routed Pump.fun sell_v2 | 66,121,393.913083 D8Hz…pump | 6.433086307 SOL net |
| 65RPCEm87y6V | SPL Token burn | 3,162,276,660,168 raw units | Supply-reduction instruction validated |
| 5egCBX2T6wkQ | SPL Token burnChecked | 1,069,970,862,580 raw units | Supply-reduction instruction validated |
| 41ictC37ai8e | Token-2022 burnChecked | 320,573,461,117 raw units | Supply-reduction instruction validated |
| 4FpbS4C8imB8 | Direct creator transfer | 3,520,918.746848 TOMO | No market sale established |
| 4HFX91dtSKCA | Recipient incinerator transfer | 3,520,918 TOMO | Neither SPL burn nor market sale |
| 2mETmrMYJcDL | PumpSwap purchase | Decoder replayed | Rejected as a sale |
| PftAURqooa4H / 4c5BaTKrdVtD | Protocol/creator fee sweep instructions | Official discriminator/layout recognition | Rejected as market sales |

The two temporary WSOL accounts are created and closed within the transaction and therefore have no pre/post token-balance entry. Initialization establishes the seller as owner. Each account receives the exact quote transfer and closes to the seller. Rent is 1,488,440 lamports, funded and refunded within each transaction; the transaction fee is 5,000 lamports. The iKcw transaction additionally refunds 1,513,840 lamports from the emptied TOMO account. No SyncNative instruction is present or needed to explain the observed transfer-and-close lifecycle. Both native ledgers reconcile exactly.

For 2gEs, gross SOL is 83,508,925 lamports; protocol fee 793,335; creator fee 250,527; seller proceeds 82,465,063. For 5MCF, gross SOL is 6,514,517,780; protocol fee 61,887,919; creator fee 19,543,554; seller proceeds 6,433,086,307. Neither event creator field alone is used to establish project creator identity.

Official layouts and TradeEvent fields were checked against pump-public-docs HEAD `bc35796152027d2744ca02066d305438e34b67e7`. The two routed fixtures require `maxSupportedTransactionVersion: 1`; version-0-only requests initially failed and were corrected.

## Tests and live validation

`node --test ai-media-agent/tests/*.test.js`: **202 total, 198 passed, 0 failed, 4 skipped**. Full output: `v15-automated-tests.txt`.

The four skips are older real-browser export binaries absent from this checkout. They are not reported as passing. The newly executed browser export is separate evidence: 4,347,522 bytes; 153.268 seconds; 540×960; VP8 video; Opus audio; browser readyState 4; no media error. Storytelling, audible pronunciation, caption fit and perceptual synchronization still require owner acceptance.

Offline negatives reject wrong mint, wrong seller, unsuccessful transaction, unsupported instruction, missing initialization, wrong temporary authority, wrong closure destination, missing proceeds and tampered native balances. Actual incinerator, fee-sweep and purchase transactions remain negative sale cases. Hash checks cover every saved raw fixture.

The creator API integration test replays genuine launch, funding, direct-transfer, recipient and trader-sale fixtures without live transaction requests. It verifies that the creator's zero direct balance does not become a creator sale or dump. A separately labeled synthetic editorial test verifies that an exact-seller sale reaches narration and expandable references.

Eight deployed historical endpoint checks returned the expected results with zero provider RPC calls. Live TOMO creator output identified the protocol creator, one direct transfer and one recipient incinerator movement, with zero verified creator market sales. `v15-live-validation.json` records these responses and their limitations.

## RPC consumption and caching

- 37 direct public RPC attempts, including failures/version retries and the initial discarded diagnostic read.
- 2 Alchemy transaction attempts, including the explicit unsupported-version response.
- 1 old-preview sale diagnostic request, executing one getTransaction.
- Two instrumented standalone creator requests each reported 16 provider calls: 3 indexed signature queries, 10 transaction reads, 2 current-balance queries and 1 recipient signature query.
- Eight persisted-fixture live checks: 0 RPC. Automated regression suite: 0 live RPC.
- A separate old-preview creator inspection and three full browser research flows include legacy RPC paths without request counters. Therefore a complete all-session RPC total or provider-credit cost cannot be stated reliably. The directly counted categories above total 72 attempted Solana requests; they exclude those unmetered flows.

General dynamic caching is per process and does not guarantee reuse across Vercel instances. The saved historical fixtures are permanent and bundled. A durable cross-instance transaction cache remains a limitation.

## Source and preview identity

Initial branch HEAD and deployment both matched `f6ec342dc7dcb7b740a99631cf86ccdd3eef1533`.

Intelligence implementation commit: `4f4d5be43694a7e5d276c3b3f676d73d3df6d7da`.
Narration contract correction: `5d98837a324349c9fc8bfac9ba0e3eae486ec233`.
Successful video runtime: `620635b4cad6f9c6080e53aea779a715926af06e` at https://doom404-ai-media-agent-plwpv1x9m-doom-404.vercel.app/ .

The final follow-up adds this report, live evidence, stronger fixture-integrity/truncation tests and V15 filename identity. It does not change classifier or narration behavior. Consult the final delivery message for the exact final branch HEAD and matching preview.

## Files changed

Application APIs: `api/creator-intelligence.js`, `api/sale-evidence.js`, `api/narration.js`.

Shared modules: `lib/sale-reconciliation.js`, `lib/curve-sale-evidence.js`, `lib/burn-evidence.js`, `lib/token-movements.js`, `lib/fee-evidence.js`, `lib/creator-summary.js`, `lib/transaction-evidence.js`, `lib/pump-trade-event.js`, `lib/pump-event-schema.json`, `lib/protocol-evidence.js`, `lib/protocol-layouts.json`.

Editorial/export/config: `universal.js`, `narrated-export.js`, `vercel.json`.

Tests/evidence: `tests/v15-historical.test.js`, `tests/v15-creator-integration.test.js`, `tests/v15-narration-contract.test.js`, `tests/editorial.test.js`, `tests/v14-intelligence.test.js`, `tests/protocol-evidence.test.js`, `tests/fixtures/historical/index.json`, `tests/fixtures/historical/expected.json`, `acceptance/v15-automated-tests.txt`, `acceptance/v15-live-validation.json`, `acceptance/v15-completion-report.md`.

## Limitations and acceptance

- PASS applies to the executed historical matrix, shared creator API integration, offline regression checks, live browser briefing and completed media export.
- Pump.fun sell_v2 native settlement is validated. Legacy sell and sell_v3 decoders are recognized, but their unvalidated settlement variants fail closed. Additional fee schedules and ambiguous routes also fail closed.
- Burn verification supports owner-authorized cases. Delegate and multisig authorization require additional historical proof.
- Fee-sweep recognition does not establish creator receipt, common wallet ownership or token-specific fee-collection attribution. No unsupported positive fee-collection claim was added.
- Creator history remains explicitly bounded; related-wallet ownership and exposure are not inferred. General cross-instance caching and complete RPC billing remain incomplete.
- Solscan's accessible curve page corroborated the Sell label; its rendered pages did not provide complete independent balance evidence for every fixture. Exact amounts above rely on the retained finalized transaction evidence.

**Handover: ready for owner-led transcript, storytelling, narration, caption and playback acceptance within the validated scope. No V15 freeze or production deployment was performed.**
