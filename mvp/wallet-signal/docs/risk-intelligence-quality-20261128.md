# Risk intelligence and trader impact closure — 28 November 2026

Baseline: bb2896b9015feeabcc5e5b7e205b340a4fc986d5. Presentation-only corrections. No production promotion.

## RI completion register

| Requirement | Result |
|---|---|
| RI-01 | Deterministic headings, factual evidence and conditional trader impact. |
| RI-02 | All ten positive criterion contributions explained, including Holder 13.35 + 3.93 = 17.28. Shared criterion totals labelled non-additive. |
| RI-03 | Explicit attribute mapping registry; transaction relationships do not establish ownership. |
| RI-04 | Historical fee-recipient authorization maps to Creator; source evidence and scores unchanged. |
| RI-05 | Critical findings always visible; remaining findings ordered by existing weighted contributions, then unresolved evidence. |
| RI-06 | 1/10/100 SOL reference sale estimates; quote basis, fee coverage and unavailable states preserved. |
| RI-07 | Reusable registry for every supported scoring criterion and current material flag. |
| RI-08 | Defined criteria assessed / partial / insufficient wording; neutral zero count; singular/plural. |
| RI-09 | Existing panels, styling and navigation retained; no CSS or homepage changes. |

## Criterion-to-finding reconciliation

| Criterion | Attribute | Explanation |
|---|---|
| supply_dilution | token_security | Active mint authority: Additional token issuance could dilute existing holders. |
| holder_asset_seizure | token_security | Token seizure controls: An authorized delegate could move or burn affected holders’ tokens without approval. |
| transfer_and_fee_friction | token_security | Transfer controls and fees: Restrictions could prevent transfers or sales; applicable fees could reduce value received. |
| eligible_distribution_risk | holder_intelligence | Holder concentration: Large holders selling their tokens could create significant selling pressure. |
| material_relationship_exposure | holder_intelligence | Connected wallet exposure: Linked holders selling could increase selling pressure. Common ownership or coordination is not established. |
| exit_cost_and_depth | liquidity_quality_safety | Trading exit costs: Larger sell orders may receive less value than expected because they consume available liquidity and incur applicable fees where assessed. |
| current_lp_withdrawal_exposure | liquidity_quality_safety | Liquidity withdrawal exposure: Exercising available withdrawal rights could reduce liquidity and make selling more costly. |
| reserve_valuation_buffer | liquidity_quality_safety | Liquidity backing: Limited liquidity relative to token valuation could make larger exits more sensitive to selling pressure. |
| attributed_wallet_exposure | creator_intelligence | Creator holdings: If the creator sells these tokens, selling pressure could affect other holders. |
| observed_market_and_transfer_disposals | creator_intelligence | Creator sales and transfers: Verified sales represent observed selling activity. Transferred tokens could create future selling pressure; transfers alone do not establish sales. |

## Finding classification and mapping

| Finding | Presentation attribute | Classification |
|---|---|---|
| mint_authority_active | token_security | Observed factor; existing critical severity retained when supplied |
| freeze_authority_active | token_security | Observed factor; existing critical severity retained when supplied |
| permanent_delegate | token_security | Observed factor; existing critical severity retained when supplied |
| transfer_restrictions | token_security | Observed factor; existing critical severity retained when supplied |
| mutable_transfer_fee | token_security | Observed factor; existing critical severity retained when supplied |
| transfer_fee | token_security | Observed factor; existing critical severity retained when supplied |
| unsupported_extensions | token_security | Unresolved material evidence |
| unverified_extensions | token_security | Unresolved material evidence |
| unsupported_program | token_security | Unresolved material evidence |
| high_holder_concentration | holder_intelligence | Observed factor; existing critical severity retained when supplied |
| connected_holder_exposure | holder_intelligence | Observed factor; existing critical severity retained when supplied |
| reported_pool_concentration | liquidity_quality_safety | Observed factor; existing critical severity retained when supplied |
| outstanding_lp_withdrawal_upper_bound | liquidity_quality_safety | Unresolved material evidence |
| material_lp_withdrawal_exposure | liquidity_quality_safety | Observed factor; existing critical severity retained when supplied |
| external_vault_delegate | liquidity_quality_safety | Observed factor; existing critical severity retained when supplied |
| protocol_admin_controls | liquidity_quality_safety | Observed factor; existing critical severity retained when supplied |
| selling_disabled | liquidity_quality_safety | Observed factor; existing critical severity retained when supplied |
| withdrawals_disabled | liquidity_quality_safety | Observed factor; existing critical severity retained when supplied |
| reference_exit_unavailable | liquidity_quality_safety | Unresolved material evidence |
| severe_reference_exit_cost | liquidity_quality_safety | Observed factor; existing critical severity retained when supplied |
| route_lp_controls_unassessed | liquidity_quality_safety | Unresolved material evidence |
| historical_fee_recipient_mismatch | creator_intelligence | Unresolved material evidence |
| creator_material_external_transfers | creator_intelligence | Observed factor; existing critical severity retained when supplied |
| creator_verified_disposals | creator_intelligence | Observed factor; existing critical severity retained when supplied |
| creator_disposition_unresolved | creator_intelligence | Unresolved material evidence |

## Before and after

| Before | After |
|---|---|
| Holder 17.28, 70% coverage, no material findings with no explanation | Observed concentration 13.35 and connected exposure 3.93; impacts explained, no new critical label. |
| Fee-recipient mismatch prominent in Liquidity | Creator authorization unresolved; no direct trading or reserve effect established. |
| Exit cost contribution unexplained below severe warning threshold | Actual 1/10/100 SOL estimates and conditional impact, unchanged severe threshold. |
| Assessment complete | Defined criteria assessed. |

## Fee-recipient rationale

Retained lq09-458811200.json explicitly records authorizationVerified=false and withdrawalConfirmed=false. liquidityFeeSettlementAssessment.mjs distinguishes reconciled fee transfers from authorization and LP withdrawal. The mismatch flag establishes a different recipient, not a direct adverse relationship to executable depth, trading restrictions, LP withdrawal rights or reserve exposure. It is therefore presented under Creator as unresolved authorization, not misconduct or liquidity withdrawal. Fee transfer records remain intact. No rescans.

## Validation and parity

2,144 regression tests pass (2,137 baseline cases retained, 7 new tests). Production build passes; optional persistence integration remains SKIPPED_NOT_OPTED_IN. Seven deterministic presentation scenarios assert every positive criterion explained, critical retention, deduplication and assessment immutability. Existing regression fixtures cover retained PAID, previously assessed tokens, recent launches, concentration, creator gaps, protocol quotes and privileged controls; no new live token assessments were requested for this sprint.

Five tabs at eight widths (320, 337, 360, 390, 449, 768, 1024, 1440), 50 baseline/current tab checks and 120 edge-case checks: no overflow, zero page errors, zero external requests. Saved-report reload, mint copy and navigation pass. Screenshots are deterministic retained-fixture browser captures, not physical Android receipts.

Scoring/coverage/formula files, weights 15/30/35/20, all APIs/security/quota/release controls, providers/decoders/checkpoints and Supabase code remain byte-identical to baseline. No scoring defect identified. PAID replay remains overall 15.15/100, coverage 83%; Holder 17.28/100, coverage 70%. UI structure, CSS and homepage unchanged; risk text naturally changes panel height. Blockchain/provider requests: 0. No paid services or AI dependencies.

Remaining acceptance: owner review of intelligence wording and physical Android check. Preview verification does not certify future blockchain state. Production promotion intentionally excluded. Deployment identifiers are supplied in the handover.
