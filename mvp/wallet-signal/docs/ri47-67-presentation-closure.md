# RI-47–67 presentation correction evidence — 28 November 2026

Scope: presentation only. Approved scoring weights, scoring thresholds, original risk inputs, underlying source findings and evidence coverage remain unchanged. Physical Android and independent current blockchain acceptance remain separate.

| Requirement | Implemented behavior | Verification status |
|---|---|---|
| RI-47 | Concentration impact explicitly qualifies unrestricted transferability, beneficial ownership and actual selling. | Verified by replay; live control investigation remains separate. |
| RI-48 | Aggregate and largest-wallet concentration share one primary finding, both raw indicators, and one existing criterion contribution. | Verified; engine still retains both source flags. |
| RI-50 | Numerical reference quote prose is suppressed beside compact quote columns; decisive unavailable-sale/control evidence stays visible. | Verified render regression. |
| RI-51 | Creator not established displays one supported concise limitation and suppresses the empty event grid. | Verified render regression. |
| RI-54 | Combined unresolved allocation uses raw balances from one supply denominator and deduplicated token accounts. Conflicting duplicate records, inconsistent mint/supply and impossible sums fail closed. Infrastructure and verified restricted principal are excluded; unresolved surplus remains. | Verified synthetic invariant tests. Basket's actual distinct-account proof still requires live evidence. |
| RI-55 | Material combined exposure >=20% is grey and prominent near the numerical score, with no added points or sellability claim. | Verified replay: 7.0234% + 15.7918% = 22.8152%, displayed 22.82%. This synthetic regression is not independent current Basket proof. |
| RI-56 | Reported concentrated pools with >=10% reference exit estimates and unassessed withdrawal bounds receive a combined conditional explanation. | Implemented; actual LP rights remain an independent evidence gate. |
| RI-57 | Shrinking/wrapping grid/flex content, abbreviated copy/explorer addresses, full technical evidence wrapping. | Implemented; browser matrix owned by coordinated validation. |
| RI-58 | Primary percentages retain normal two-decimal presentation. Existing <0.01% precision exception preserved to avoid falsely reporting positive LP claims as zero. | Verified existing 0.003645% LP claim regression; scoring precision unchanged. |
| RI-59 | Incomplete zero event totals show None recovered; completed zero event totals show Verified zero; current zero balance shows Verified zero. | Verified; no history-complete promotion introduced. |
| RI-60 | Processed signatures remain separate from verified events; no event recovery is inferred from processed count. | Presentation verified; retrieval defects addressed independently. |
| RI-61 | Verified high-risk scored findings show orange-red beside the score; unresolved material allocations stay grey. | Verified replay: low overall 18.41 and high 18.28% 100-SOL estimate coexist unchanged. |
| RI-65 | 1/10/100 reference estimates receive independent severities using existing exitSeverity thresholds. | Verified replay: 1.45% low, 3.26% moderate, 18.28% high. |
| RI-66 | Estimated selling cost for fee-inclusive; Estimated selling shortfall · Fees not fully verified for shortfalls; technical basis retained expanded. | Verified; unverified shortfall never receives fee-inclusive proceeds. |
| RI-67 | One short creator-history qualification plus shared None recovered explanation; full accounting stays expandable. | Verified render tests. |

RI-49, RI-53 and RI-68–75 require separate freshness, pipeline and live evidence verification and are not marked complete by these presentation changes.

Validation command: node --test tests/ri47-67-report-corrections.test.mjs tests/trader-risk-explanations.test.mjs tests/ri16-42-calibration.test.mjs tests/final-intelligence-corrections.test.mjs tests/ri43-46-visual-severity.test.mjs tests/practical-evidence-precision.test.mjs tests/evidence-hud.test.mjs tests/risk-calibration-v21.test.mjs tests/ui-presentation.test.mjs tests/hud-final.test.mjs tests/creator-evidence-rendered-labels.test.mjs tests/simplified-report.test.mjs

Result: 121 passed, 0 failed. Eight new requirement regressions added. Existing grouped concentration assertion now expects one displayed critical with two retained source indicators; empty creator HUD assertion now expects the specific concise limitation. No scoring or security test weakened.
