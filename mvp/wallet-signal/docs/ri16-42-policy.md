# RI-16–RI-42 calibration candidate — 28 November 2026

Baseline: 44e3d6ee900b05787e03a5a1f3530795eaaea722. Production promotion is prohibited without explicit owner authorization. This candidate is **not a completed release gate**.

Weights remain Security 15%, Holders 30%, Liquidity 35%, Creator 20%. Risk points, evidence coverage and individual severity are separate. No missing-evidence penalties or weight renormalization were introduced. Numerical criterion formulas remain unchanged. One coverage defect was corrected: a saturated holder risk component no longer declares an incomplete holder sample fully assessed. Eighteen eligible wallets previously earned the full 70 distribution-coverage points when concentration saturated; they now earn 63. Risk points remain 70. This reduces weighted overall coverage by 2.1 percentage points in that case.

## DOOM404 V1 severity policy

These are product policy thresholds, not universal standards. Eligible observed subsets establish minimum concentration only; no extrapolation. Verified pool accounts and known program authorities remain outside the ordinary-wallet subset. Program exclusion is not proof that every excluded account is infrastructure; restricted allocations and custodian control remain unresolved when not classified.

| Metric | Limited | Moderate | Elevated | High | Critical |
|---|---|---|---|---|---|
| Eligible aggregate supply share | <15% | 15–<30% | 30–<40% | 40–<50% | ≥50% |
| Largest eligible wallet | <5% | — | 5–<10% | 10–<20% | ≥20% |
| Stated reference sale metric | <2% | 2–<5% | 5–<10% | 10–<20% | ≥20% |

Quote severity explicitly names the metric: fee-inclusive exit estimate, quote recovery shortfall or provider price impact. A shortfall is never promoted to a fully fee-inclusive total cost. Proceeds require a compatible valuation basis and fee-inclusive estimate. One route's limitation never establishes that all routes fail. Provider errors and unavailable quotes do not create a verified inability-to-sell warning.

Score colours: <30 light green, 30–<60 amber, ≥60 red; these indicate observed numerical risk only. A separate red critical status can coexist with a low or unpublished overall score. Coverage colours: 0 grey; >0–<50 muted red; 50–<80 amber; 80–<100 light green; 100 green. Coverage measures evidence completeness, never token safety.

## Correction register

| RI | Status | Root cause and correction / remaining scope |
|---|---|---|
| 16 | Completed and verified | Aggregate flag used >50/high only. Versioned half-open policy now handles every requested boundary and minimum observed samples. |
| 17 | Partially completed | Independent largest-wallet alert was absent. Implemented ≥20 critical and exact boundaries. Full custodian/vesting/treasury control classification still not established for all candidates. |
| 18 | Completed and verified | Weighted score could obscure a severe finding. Independent critical banner and always-visible alert list preserve the numerical score. |
| 19 | Completed and verified | No compound explanation. Added concentration ≥30% plus quote metric ≥5% conditional interaction, with zero additional score points. |
| 20 | Completed and verified | Old critical classification followed saturated depth points, including 15% large-order impact. Replaced with size-specific ≥20% critical policy; 10–<20 high. Numerical depth formula retained. |
| 21 | Partially completed | Quote failures discarded all observations. Per-size provider timeout/error/invalid-route evidence retained; no failure becomes executable=false. Complete protocol-specific failure taxonomy is not yet available for every adapter. |
| 22 | Completed and verified within retained model | Verified negative reference execution can fully assess the depth criterion; missing quote metrics leave it incomplete. Adverse observations do not reduce coverage. No complete live TOMO replay claimed. |
| 23 | Completed and verified | Compact quote cells accepted only fee-inclusive values. Shared canonical metric selection now powers compact cells and chart; numerical recovery shortfalls remain visible with their actual basis. |
| 24 | Completed and verified | Shared quote projection preserves fee basis and restricts proceeds examples; focused parity tests cover all three metrics. |
| 25 | Completed and verified | Alchemy route identifier appeared as a protocol. Provider, quote source, routing and returned pool addresses are separate; underlying protocol remains unresolved when not independently identified. |
| 26 | Partially completed | Existing direct pool controls cover PumpSwap and Raydium CPMM; up to two candidate pools are inspected. No new Orca/CLMM/Meteora withdrawal decoder was implemented. No quoted route or low LP claims is called permanently locked. |
| 27 | Partially completed | Earliest-three candidates and two supported creator decoders limit discovery. Expanded to twelve bounded candidates. FLOAT LaunchLab role retained; metadata authority is explicitly distinct. GTA6/ANSEM/SI/TRUMP complete attribution remains unresolved. |
| 28 | Partially completed | Expanded bounded candidate window and explicit terminal metadata; no unsupported generic fee-payer/authority becomes project creator. Additional archival pagination/unsupported launch decoding remains open. |
| 29 | Partially completed | Enrichment required a previously verified ≥1% purchase, excluding FLOAT with zero purchases. Positive holdings plus zero acquired events now trigger the existing two spare reads. Added a strict direct SPL receipt verifier; actual FLOAT acquisition mechanism remains unestablished. |
| 30 | Completed and verified for cap diagnosis; recovery partial | Nine transactions = one creation plus eight selected recent transactions. Exposed bounded stop reason, retained event classes and progressive early token-account query without raising the 18-request cap. Lifetime pagination remains incomplete. |
| 31 | Partially completed | PAID exact six-to-34 aggregation and 73,894.650006 diagnostic difference preserved. Missing opening balance and continuous history prevent a reconciled balance label. No invented receipt. |
| 32 | Completed and verified | Incomplete creator history event zeroes now say “None recovered in assessed history”; current verified zero balance stays numeric. |
| 33 | Partially completed | Existing transaction reuse, top-three prioritization, dust and mint filters retained. No common ownership claim. Broader exchange-source exclusion and additional relationship history remain unresolved. |
| 34 | Partially completed | RPC largest-account endpoint returns at most twenty token accounts; exclusions/grouping produce 17–19 wallets. Counts/scope exposed. No approved paginated holder index was added, so twenty eligible wallets cannot always be recovered. |
| 35 | Partially completed | Existing same-owner aggregation retained; program/custody/vesting/treasury allocation taxonomy remains incomplete. Program-account exclusions must not be interpreted as verified infrastructure. |
| 36 | Completed and verified for supported Token-2022 controls | Active fee-config authority can change both rate and cap; current 1% is not a future maximum. Alert now critical with supported 100% protocol rate ceiling, cap and epoch caveats. Existing 35-point shared criterion unchanged. |
| 37 | Completed and verified | Configured and mutable fee findings shared 35 points. Grouped into one transfer-fee control finding; supporting technical evidence and criterion table retained. |
| 38 | Completed and verified | Critical status, weighted risk, coverage, drivers and unresolved items shown independently; publication threshold unchanged. |
| 39 | Completed and verified for methodology audit | Creator 60% = assessed direct-wallet-exposure criterion; remaining 40% disposition history remains incomplete. API completion does not earn coverage. Attribution alone does not prove history or independence. |
| 40 | Completed and verified for methodology audit | 59.5/63/66.5/70 = 17/18/19/20 × 3.5 distribution coverage, separate from relationship criterion. Saturation exception removed. Eligibility-classification limitations remain as RI-35. |
| 41 | Completed and verified | Zero-coverage attributes are unassessed; partial zero points include missing-criteria explanation. Critical alerts remain independent. |
| 42 | Completed and verified in emulation | Coverage text and bar follow requested completeness bands; text semantics retained. Physical Android review remains required. |

## Validation limits

The seven owner tokens were resolved from retained scan records and independently matched by full mint. Only PAID has the complete retained report-input fixture available in this checkout. Other owner figures are retained owner observations, not reconstructed complete report payloads. Their calibration scenarios are separately labelled; no fabricated before/after full assessment.

The existing 15-token matrix retains attribute outputs, not every raw input/flag. It can validate the unchanged weighted aggregation; it cannot retrospectively prove holder classifications, creator attribution or quote parity for every original observation.

Fifteen additional live mints were selected in returned order from the current DexScreener latest-profile feed, then checked through existing Alchemy. Live security and atomic concentration subsets were assessed. These are **not fifteen complete end-to-end scanner passes**. Ten discovered token accounts plus the mint were read in each same-slot subset; program authorities were excluded conservatively and ordinary owner-account state checked separately. The connector truncates larger account payloads at about 8 KB; the ten-account subset is explicit and never labelled Top-20. The sample is primarily recent Token-2022 launches and does not complete the requested established-token/protocol diversity, creator history or executable-liquidity testing. Stage B remains partial, not silently passed. See ri16-42-additional-live.json for full mints, slots, timestamps, scopes and replay inputs.

No provider budgets, API quotas, concurrency policy, security workflow, release approval or database schema was changed. No broad historical backfill. A separate one-hour baseline share-link request was rejected by automatic approval review; no protection change occurred. No bypass workaround was used. Connected Alchemy reads and isolated local replay were used instead.

## Production gate and rollback

Do not promote this partial candidate. Complete unresolved intelligence investigations, diverse complete live testing and owner Android acceptance first. Run exact-SHA security/regression checks. Obtain explicit owner authorization of the exact SHA/deployment/project/branch tuple, then use the existing reviewed-SHA workflow and database-owner approval procedure in ri10-15-release-readiness.md. Never weaken native checks or quotas. Preserve the current production deployment/domain tuple before any authorized promotion. On failure use the approved known-good production rollback, retaining evidence/checkpoints and verifying runtime tuple, aliases and smoke tests. No production promotion or rollback was executed here.
