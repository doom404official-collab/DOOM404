# Autonomous engine source audit — 28 November 2026

Release qualification remains open. No production promotion is authorized.

## Source lineage

The abbreviated source publication resolves to `4303f624a0c17c155db3806102797bc9928fbee9`, a descendant of integration baseline `e9be17b5591511abeb6d7454c031d80c20ef6dc2`. Existing evidence and valid source changes are retained. Private Vault exports are excluded from source publication.

## Token-specific path inventory

Paths below are relative to `mvp/wallet-signal/`. Historical restrictions appear to have originated as fixture-bound proof and recovery safeguards; this is inferred from code comments and assertions, not an independently recovered design decision.

|File / function|Previous behavior and generalization limit|Correction / regression evidence|
|---|---|---|
|lib/canonicalHolderObservation.mjs / canonical observation validation|Pinned PAID mint, snapshot, slot, run and commit; rejected equivalent other-mint evidence.|Validate schema, mint binding, raw totals, observation slots and recomputed canonical content/holder hashes. PAID reference and unrelated-mint tests retained.|
|lib/holderRelationshipsV2.mjs / relationship assessment|Pinned mint, observation and membership digest.|Recompute membership hash and verify unique token-account balances and source identities from supplied canonical checkpoint. No beneficial ownership claim.|
|lib/dashboardEvidenceBridge.mjs / evidence reads|PAID-only conditional canonical snapshot/job lookup.|Schema-version-bound latest snapshot and job queries for the input mint; scoring bridge still enforces holder membership/freshness.|
|lib/liquidityLq09Reconciliation.mjs / historical fee reconciliation|Pinned mint, pool and historical observation slot.|Decode actual pool state; verify PDA, mint, supplied slot, protocol global config and raw transfer arithmetic. PAID historical amounts unchanged; unrelated pool/mint regression added. No authorization or permanent-lock promotion.|
|lib/holderEligibleViewPolicy.mjs / archived eligible view|Embedded PAID snapshot and allocation policy.|Historic policy data moved to tests/fixtures/archived-holder-policy.mjs. Generic validator requires an explicit evidence-bound archival policy. Original archive assertions retained.|
|lib/holderCollectionLineage.mjs / collection receipt|Pinned PAID source run, job, commit and snapshot.|Validate the supplied receipt against snapshot identity and contents. This validates retained provenance structure; it does not authenticate arbitrary external claims.|
|lib/holderFrozenObservation.mjs / snapshot read|Pinned mint/slot was the default read.|Default becomes mint-bound schema-2 canonical read. Legacy explicit archival policy/receipt remains test/archival input.|
|app/GlitchV11Dashboard.jsx / historical snapshot disclosure|PAID mint condition and fixed historical links.|Disclosure binds supplied snapshot identity to report mint; links/slot come from retained evidence. Approved primary layout preserved.|
|app/api/holder-network-merge-controlled/route.js|Privileged manually pinned reference merge endpoint.|Retired with HTTP410 after existing admission/auth wrapper; no store/provider mutation. Old source contract retained only as a test fixture.|
|app/api/holder-scan-recovery/route.js|Privileged pinned historical recovery endpoint.|Same HTTP410 retirement; old contract retained test-only.|
|app/api/internal/holder-scan-smoke/route.js|Manually pinned privileged smoke action.|Retired with HTTP410 after authentication/admission.|
|app/api/liquidity-archive-state-verify/route.js|Pinned historic pool/archive diagnostic.|Retired with HTTP410; no live evidence mutation.|
|lib/holderActionsRecovery.mjs, lib/holderRecoveryGuard.mjs and CLI recovery dependencies|Old explicitly pinned, dated manual maintenance allowlist.|Not imported by the application production graph; retained offline maintenance safeguards, not first-scan evidence. Not generalized into an unsafe arbitrary repair tool.|
|Existing Vault records|Some historical records were manually investigated.|Preserved as reference/cache with provenance; isolated core qualification never reads them. No claim that their presence proves autonomous discovery.|

A production-import-graph regression excludes test/script imports and known reference mints. Its scope is source imports and known literals, not proof that every possible database/configuration workaround is absent. Wider ingestion provenance and unseen runtime qualification remain release gates.

## Supported mechanisms and limitations

|Mechanism|Discovery / proof|Retrieval and decoder|Validation scope / limitation|
|---|---|---|---|
|SPL Token and Token-2022|Actual mint account owner, parsed or supported binary state/extensions.|Existing mint/security/account parsers.|Program identification does not establish project creator. Direct generic mint authority/payer is not asserted as creator.|
|Pump.fun creation and supported historical create_v2 layouts|Protocol program, supported discriminator/layout, actual mint birth, assigned creator role.|Bounded ascending indexed candidates and transaction-local role decoder.|Known recorded ANSEM/CATE and live DCTY; not all historical/future versions. DontFront/cashback options only where supported exact layout is recognized.|
|Raydium LaunchLab supported legacy/Token-2022 initializations|Pinned SDK layout; designated creator distinct from creation user/payer.|launchLabCreatorOrigin and boundedCreatorOriginV2.|Recorded Basket and existing FLOAT regressions; unknown launch mechanisms remain unresolved.|
|PumpSwap V2 buy/sell and Pump curve V2/V3 supported legs|Exact instruction accounts, verified protocol PDAs, signer, checked asset transfers, quote payment and transaction balance equation.|routedTokenTrade, installed PumpSwap SDK2.1.0; Pump public IDL observed at commit e244b35ba70864c029411e81ed1bbd4dee4d2926.|Recorded actual CATE native-SOL purchase, DCTY swaps and zero-net Jupiter intermediate exclusion; not generic support for every Jupiter underlying protocol.|
|Pump holder reward distribution|Protocol instruction and exact receipt/balance binding.|pumpHolderRewardReceipt.|26/26 reference receipts matched by transaction+instruction+raw amount in live isolated core cold/warm run46170952969, SHA3ff186e7fcf451e821090991357a3800b51ce205. This is not hosted full-report qualification.|
|Streamflow supported metadata/control layout|Actual funding receipt, metadata and escrow relation, fresh controls and program upgrade state.|streamflowCreatorMovement / streamflowAllocationControls.|Existing FLOAT evidence retained; arbitrary escrow/vesting/Magna controls are not inferred.|
|Material external transfer recipient|Verified transfer and finalized source/destination binding, fresh mint/account/authority snapshot.|materialTransferRecipient.|One material recipient within remaining existing request budget. Subsequent movement chain, linked owners and historical largest-holder overlap can remain unresolved.|
|Closed associated token account discovery|Derive ATA candidate using the creation receipt's unambiguous actual token program.|creatorTokenHistoryV1.|Candidate address is not ownership proof; inspect finalized mint-bound receipts. Non-ATA closed accounts still require discovered historical metadata.|

## Controlled fallback and persistence

Origin retrieval tries primary indexed evidence, existing Helius indexed fallback where configured, then a bounded standard signature window and at most two unseen receipts. Standard newest-signature fallback is never claimed to be exhaustive earliest history. Quota/deadline failure terminates; repeating unsuccessful identical requests is not an investigation strategy.

Token-account history resumes bounded indexed cursors, replays after decoder epoch changes, refreshes exhausted windows, and preserves historical associations. Missing pagination metadata never certifies completion. General historical secondary-provider/account-index fallback remains incomplete.

Normal runtime CAS observations persist events, receipt provenance and private continuation checkpoints. Public projections strip raw transaction cache and private cursors. An append-only normalized creator evidence archive now receives verified events atomically with the normal CAS finish; runtime and qualification namespaces are distinct. Isolated PostgreSQL tests verify exact raw amounts, idempotence, role restrictions and a 15-second expiry for unfinished cursors. Hosted normal-runtime and comprehensive ingestion qualification remain open. A separate append-only, service-only qualification table retains isolated cold/warm observations without reading, deleting or seeding production token records.

## Acceptance boundaries

Local regression/build and exact-source CI are engineering evidence. Known-token live core checks do not constitute blind unseen-token, full-dashboard, fresh-holdout, physical Android or ten-second full-report acceptance. No universal coverage, complete lifetime recall or release-ready claim is made.

Exact-source CI at 6e42379886bf8f715c7325477e6e32cc935fc8ef passed 2,431 tests, production build, 31 focused security tests, PostgreSQL concurrency/archive checks and 128 saved-report browser checks over five tabs/eight widths. Earlier browser installation failed on ubuntu-latest26.04 with pinned Playwright1.56.1; pinning the supported Ubuntu24.04 runner fixed the environment without weakening assertions.

Automatic deployments for qualification and integration branches are disabled during qualification. This does not authorize production promotion. A consolidated protected preview must be created explicitly only after the qualification gate is satisfied.

## Post-blind corrections (pending new live candidate verification)

The frozen `aceadc0db3ef9a29234be41101f2857426a6945d` isolated backend-core run captured all 20 cold and 20 warm observations before any independent token investigation. It failed intelligence qualification: eight of ten independently supported creation roles were asserted correctly, two were missed, and only one historical event was asserted. Ten older direct/custom issuance cases remain unresolved rather than attributed from a fee payer. This is not hosted full-report qualification.

Post-scan Helius references comprise at most twelve earliest mint transactions plus twelve earliest transactions from the scanner-discovered account, where available. These are a bounded reference scope, not lifetime histories. Review uses official creation roles and reviewed proof producers; the latter is not an independent decoder implementation. Raw references remain in the private Vault and are not published.

Reusable corrections address documented LaunchLab optional account suffixes, LaunchLab trade economic boundaries, Pump optional boolean arguments, historical Pump/AMM account roles, closed temporary quote account initialization, same-transaction quote-vault birth, and direct Pump buyback fee reconciliation. Pump typed TradeEvent amounts must match the actual actor/mint/side/token boundary under the verified self-CPI; the buyback amount must reconcile both the recipient and curve lamports. On-chain Clock time is retained separately from estimated block time. A mismatch remains unresolved.

Streamflow metadata discovery now validates the protocol create account contract and escrow PDA separately from the narrow creator funding proof. Extra treasury instructions no longer block fresh metadata inspection. Exact sender outflows distinguish escrow deposits and protocol fees without adding either to sales or double counting their inclusive external-transfer total. Classic Token and Token-2022 funding receipts require their actual token program. Current allocation controls still require fresh metadata verification and must not inherit a creator relationship from a different sender.

The bounded independent reference review currently proves 34 events in receipt replay; only one matched the original frozen scanner output. Two nonzero receipts remain unresolved under an unsupported opaque wrapper. Pump V3 direct native sale payout now requires the complete actor lamport equation, explicit System flows, verified closed wrapped-SOL refunds and fee payer charges, plus the independent curve and buyback equations. This correction still requires live verification. This is not a claim that all accessible events were recovered. These material limitations prevent release qualification. Corrected receipt replay is not autonomous live recovery, and the twenty now-observed tokens are development cases, not a fresh holdout set.

## Subsequent blind/holdout findings and source correction

Candidate650dc439876ec514349ce0853b02c96fdf405aeb completed80 core scans in run46178210064-1: ten known cases, twenty corrected-case replays and ten fresh holdouts, each cold/warm. Independent post-scan review expands the original bounded reference scope to36 events: two initially unresolved receipts are explicit SPL burns accompanied by raw annotation instructions. The candidate recovered34/36. Its first fresh holdout recovered19/30 independently classifiable reference events; all five asserted supported creator roles were correct. Eleven legacy native Pump sales were missed. Neither set is marked passed.

The ANSEM array also contained two producer representations of one purchase instruction, although the instruction-keyed ledger counted it once. The correction uses class-relevant proof states for semantic deduplication, preserving amount/class/required-proof conflicts for ledger quarantine.

The new signed-burn producer reconstructs and verifies the complete Ed25519-signed message, including raw annotation instructions, and requires the exact source and whole-wallet token boundary. Unsupported CPI/lookup-table reconstruction remains unresolved. Native legacy-sale proof checks typed trade amounts, actor lamports, creator-vault PDA, protocol/buyback split, each recipient's balance and the curve equation. No token/creator/signature constants enter production logic.

The execution environment became unavailable before the local material-recipient history draft and report replacements could be retained. The three critical corrections were reconstructed from the inspected source through GitHub APIs and require exact-source CI/live verification. The unrecovered tracing draft is not claimed as published or qualified. Production and the protected deployed baseline remain unchanged.

A second fresh ten-token set is selected without prior on-chain forensic lookup, has zero source occurrences in the local preflight completed before the environment loss, and zero records across thirteen Vault tables at the fresh preflight. This replaces no prior result. CI and normal core scans must finish before any qualification claim. Full hosted application, material investigation closure and the ten-second full-report gate remain unqualified.
