# RI-10–RI-15 release candidate — 28 November 2026

Baseline: 5f854e22f8a0148376203f421d562a4ef5a6cfbf. No production promotion authorized.

## Completion register

| Item | Result | Evidence |
|---|---|---|
| RI-10 | PASS | One classified, deduplicated finding collection drives attribute and Overview counts. Critical risks, scored observed factors, unresolved evidence and unscored context are separate. Critical warning headlines remain visible; additional collapsed findings show a count. |
| RI-11 | PASS | Three fee-inclusive quote cells; unavailable differs from zero. Proceeds require an explicit spot notional basis or protocol quote fields supporting it. Existing detailed chart and quote methodology retained. |
| RI-12 | PASS | Protocol administrator summary explains conditional operating effects; original technical details remain in supporting evidence. No creator-control, withdrawal or trading-stop inference. |
| RI-13 | PASS | Fee recipient mismatch is supporting-only, under Unresolved authorization evidence. No numerical penalty or primary verified risk count; source LQ-09 records unchanged. |
| RI-14 | PARTIAL | Exact retained event aggregation and six-to-34 increase reproduced. No duplicate purchase inflation. Complete archival ledger and independently replayable full bodies for all 28 recent burns are unavailable in the current retained receipt set. Observations remain bounded historical evidence. |
| RI-15 | PASS | Critical red warning, observed amber warning, contextual neutral information, unresolved neutral question; text categories accompany icons. No design restructure. |

## Before and after

Holder: `0 material findings` becomes `0 critical risks | 2 observed risk factors`. Liquidity: `2 material findings` becomes `0 critical risks | 1 observed risk factor | 2 contextual observations`. Creator fee authorization is counted separately as unresolved evidence and relocated to supporting evidence. Liquidity concentration and administrator controls have no criterion contribution and are explicitly contextual; no new thresholds or points.

Exit costs: repeated technical paragraphs become three SOL-equivalent cells. Actual retained cache: 1 SOL 1.021234%, 10 SOL 1.657762%, 100 SOL 7.599965%, displayed 1.02%, 1.66%, 7.60%. A spot-valued 100 SOL position has approximately 92.4 SOL estimated proceeds. These are assessed-state estimates, not execution guarantees. Provider recovery-shortfall or fee-unverified quotes do not qualify for the proceeds statement.

Protocol: “Protocol global operation controls…LP redemption…upgrade authority” becomes “The protocol administrator retains the ability to change certain operating settings.” The conditional impact is trading or access to liquidity depending on verified settings. Technical evidence is retained separately.

## Creator reconciliation

Read-only sources: `creator_intelligence_jobs` row updated 2026-11-26T06:17:11.568892Z; `scanner_token_investigations` row updated 2026-11-28T05:04:51.242336Z; cached scoring/current-wallet responses observed 2026-11-28T05:32Z. No blockchain requests or database writes made.

| Event | Previous unique count | Previous raw | Latest unique count | Latest raw | Duplicate inputs excluded |
|---|---:|---:|---:|---:|---:|
| Purchase | 1 | 15664233491746 | 1 | 15664233491746 | 7 |
| Burn | 3 | 9870122682565 | 31 | 9939092130424 | 0 |
| External transfer | 2 | 5200000000000 | 2 | 5200000000000 | 0 |
| Sales recovered | 0 | 0 | 0 | 0 | 0 |
| Total events | 6 | — | 34 | — | 7 |

The earlier saved acquisition ledger had five events and 9867978045081 raw burns. The additional targeted signed burn adds 2144637484 raw units, producing the six-event presentation with 9870122682565 burns. Seven repeated launch-purchase inputs in bounded cached history are deduplicated. Twenty-eight distinct burn instruction identities add 68969447859 raw units, producing 34 unique events and 9939092130424 raw burns. No sales or external transfers were added.

All token amounts use six decimals. Latest observed historical event: 2026-11-28T04:52:17Z; earliest accepted event 2026-09-15T19:20:20Z. These endpoints are not a declaration of complete intervening coverage. The legacy job update is earlier than latest retained bounded events; the UI now uses the latest accepted event timestamp where available.

Exact observed net: 15664233491746 − 9939092130424 − 5200000000000 − 0 = 525141361322 raw = 525141.361322 tokens. Actual retained current-wallet observation at slot 474828638: 599036011328 raw, 2026-11-28T05:04:50.994Z. Later cached wallet observation at slot 474836399 also reports 599036011328 raw. Diagnostic difference: 73894650006 raw = 73894.650006 tokens. No complete opening balance, complete other inflows/outflows, or compatible continuous historical coverage is established. Expected closing balance and reconciled residual remain null. The diagnostic difference is not a certified missing balance or misconduct.

Attribution: accepted outflow producer requires finalized successful transactions, attributed creator signer and token authority, matching mint, six decimals, one outer token movement and exact creator balance delta. Burns require signed-message verification; transfers cannot become sales. Outer and inner identities remain distinct. The existing ledger blocks conflicting instruction identities rather than accepting incompatible classifications; legitimate separate instructions survive. Current retained bounded receipts independently corroborate four new burn balance deltas; earlier 24 new burn full transaction bodies are not retained in this receipt set. Their producer provenance is retained, but a fresh full cryptographic replay of all 28 is not claimed. Source/destination addresses cannot be reconstructed for every retained event from compact receipts alone. This is an explicit provenance limitation, not justification for a broad rescan.

Processed signatures: 4656 retained entries, all unique. This is neither fetched-record total nor 34 verified movements. Latest bounded pass checked nine transactions and retained five event receipts; overlap with old processing is not fully recoverable. Counts must not be added to invent a lifetime total. Zero sales means no matching verified sales recovered in assessed history, not absence of lifetime selling.

See `ri10-15-creator-reconciliation.json` and read-only fixtures for exact event data, timestamps and arithmetic.

## Scoring parity

Cached Android assessment reproduces Security 0/100, Holders 17.28/70, Liquidity 23.57/100, Creator 6.64/60 (risk/coverage). Weighted observed risk: 14.7615 → 14.76. Weighted coverage: 83%. Accepted baseline and candidate produce identical component scores from the identical cached evidence. Earlier deterministic fixture yields 15.15 because its liquidity inputs differ. No methodology, weight, eligibility, threshold or score change was made. `practicalScoringV2` only adds historical timestamp metrics.

## Validation and scope

2,144 baseline cases retained; eight focused cases added: 2,152 passing, zero failures. Production build passes. Optional hosted evidence-persistence test remains SKIPPED_NOT_OPTED_IN. Existing security/release tests cover fail-closed quotas and SHA enforcement. Actual database quota mutation/concurrency is not performed in this sprint; isolated CI PostgreSQL validation remains a separate required check.

All five tabs at 320,337,360,390,449,768,1024,1440 pixels: 80 baseline/candidate tab checks, no horizontal overflow or page errors, no external requests. Screenshots use cached evidence replay, not physical Android acceptance or a live token scan. Existing 15-token calibration suite and boundary tests run within regression; no new live token investigation.

Homepage, branding, gauges, navigation, typography, footer, API routes, quotas, worker budgets, checkpoints, decoders and deployment protection unchanged. Minimal CSS only adds semantic icon colors, compact exit cells and wrapping finding counts.

## Consolidated pre-production audit

| Item | Status | Evidence / limits |
|---|---|---|
| GitHub baseline HEAD | PASS | ls-remote matches accepted 5f854e22… before changes |
| Local regression and build | PASS | 2,152 tests; Next production build |
| Final GitHub required CI | PARTIAL | Must verify exact final commit statuses after push |
| Reviewed SHA gate source | PASS | scannerReleaseGate, manual authorization workflow and API tuple checks unchanged |
| Production authorization | FAIL (intentional release gate) | No owner authorization; approval table empty; promotion prohibited |
| Canonical holders | PASS | Cached accepted snapshot ID 0596510d… and holder hash retained; frozen snapshot explicitly scoped |
| Creator aggregation | PASS | 6 → 34 exact, seven duplicate purchase inputs excluded |
| Creator complete archival accounting | PARTIAL | No complete ledger; bounded observations only |
| Liquidity / exit costs | PASS within scope | Retained cache recomputes 23.57 and three protocol quotes; inventory is provider-returned, not exhaustive |
| LQ-09 preservation | PASS | No record mutation and no additional historical account reads |
| Evidence timestamps | PASS within scope | Latest retained event distinct from job update and current wallet observation |
| Durable quota configuration | PASS | Read-only database policy inspected; token-investigation 18 RPC / 40 seconds; key evidence tables have RLS |
| Hosted concurrency proof for candidate | PARTIAL | No production quota mutation; requires successful exact-SHA security CI |
| Unsupported evidence | PASS | Regression preserves incomplete/unsupported handling and observed floors |
| Score-to-finding consistency | PASS | Focused count, deduplication, component contribution and parity tests |
| Critical visibility | PASS | Existing severity retained; critical warnings never collapsed |
| Protected preview / exact SHA | PARTIAL | Verify final deployment identity and unauthenticated protection after deploy |
| Environment configuration | PARTIAL | Existing baseline deployment READY; no secret values read or changed; no live-provider test |
| Initial scan / investigation timing | PARTIAL | Not remeasured; no new live scans; existing timing instrumentation and deadlines unchanged |
| Cached UI performance | PASS within scope | Local offline dashboard renders; no external calls; not a hosted latency SLA |
| Provider consumption | PASS | Zero new blockchain/provider calls; historical retained pass usage not attributed to this sprint |
| Rollback readiness | PASS within scope | Existing production candidate dpl_G9W8KEBCAGEn8SUonu1pGEYwHkCF is READY and listed as rollback candidate; confirm active domains before release; no rollback performed |
| Physical Android | PARTIAL | Owner review required; viewport emulation is not device acceptance |
| AI / paid dependencies | NOT APPLICABLE | None added |

Incomplete archival history and supported protocol boundaries are V1 limitations, not completed verification. Production authorization, exact-SHA required checks and final owner/device acceptance remain release gates.

## Production sequence, smoke tests and rollback

1. Review final exact commit, protected preview, bounded creator reconciliation and screenshots. Complete physical Android acceptance.
2. Confirm `scanner-security` and `scanner-regression` success on the exact commit, including isolated PostgreSQL concurrency and privilege tests. Record current production deployment/domain tuple for rollback.
3. Obtain explicit owner authorization of exact SHA and deployment. Dispatch existing `glitch-evidence-validation-manual.yml` on the integration branch with `reviewed_sha`, `candidate_deployment_id`, `candidate_url` (trailing slash), and `authorize_production=true`. Required production environment owner review must succeed; `scanner-reviewed-sha` must be green.
4. Database owner records the exact SHA/deployment/project/branch tuple with successful security/regression/reviewed run IDs, approved=true, authorized_at=now(), and expires_at='infinity' (or an owner-approved maintenance policy), as documented in the existing release runbook. Service-role approval writes remain prohibited. Retain owner authorization and SQL receipt.
5. Confirm Vercel's three native checks pass for this exact candidate. Use the existing owner-authorized native promotion flow for the exact Git-built deployment; do not substitute or rebuild silently. If Vercel requires a rebuild because environment variables differ, stop: the new artifact needs its own verification and exact tuple authorization before domains are assigned. Verify production aliases and runtime SHA/deployment/project/branch headers against the approved tuple.
6. Smoke test homepage fit and input/paste; invalid-mint rejection with zero provider calls; one bounded approved valid scan; all five tabs/counts and collapsed evidence; critical scenario; saved-report reload; quote unavailable versus zero; creator bounded sales language/timestamp; no horizontal overflow; quota and duplicate suppression; no console/server errors. Record measured latency and actual request consumption.
7. Rollback: preserve current known-good production deployment/domain tuple before promotion. On material failure, use the existing authorized Vercel rollback to that known-good production deployment, verify aliases and smoke tests. Keep evidence/checkpoints unchanged. Never roll back to an unreviewed preview or disable release checks. Reestablish auto-assignment only under owner release authorization.
