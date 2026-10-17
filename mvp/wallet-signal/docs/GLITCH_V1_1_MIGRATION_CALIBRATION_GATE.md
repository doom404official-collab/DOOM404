# GLITCH v1.1 — Legacy retirement and calibration gate
Status: IN PROGRESS; production scores remain withheld.

## Verified legacy dependencies
- lib/holderConcentrationScore.mjs is called by lib/verifiedHolderConcentrationAssessment.mjs and legacy holder tests. It uses 40/10/20/20/10 and must not be presented as v1.1.
- lib/tokenControlsAssessment.mjs has historical tests and outputs provisional token controls. Its account_concentration check violates the v1.1 security taxonomy.
- lib/tokenAssessment.js is used by legacy token assessment tests and returns prototype labels/scores.
- lib/glitchAttributeEnginesV11.mjs and lib/glitchScoringV11.mjs are new but not wired to API consumers.

## Required migration sequence
1. Inventory every import in app/, lib/, scripts/ and tests/ for the three legacy modules and their exported functions.
2. Move callers to the new engines. Preserve raw holder evidence, verified network penalty logic, creator attribution, RPC authority parsing, and historical snapshots.
3. Keep the 35-point connected-wallet engine authoritative; never substitute the old 10-point density function. Distinguish completed evidence queue from complete archival history.
4. Replace legacy test expectations with v1.1 component allocations and incomplete-evidence behavior; verify 18 component weights, N/A fee normalization, historical uncertainty and no double counting.
5. Delete obsolete files only after import search returns zero live references and full CI passes. Do not delete historical evidence, migrations, or scan worker code.

## Calibration protocol (not completed)
- Unit boundaries: every full/zero threshold, intermediate linear interpolation, fee bands, missing values, Token-2022 fee absence, and inactive/active authorities.
- Real-world sample: diverse standard SPL and Token-2022 mints, launchpad tokens, graduated tokens, thin/deep liquidity, independent/connected holders, verified/unverified creator histories.
- Independent labels and review: chain transaction proof, reserves/LP custody, executable quote tests and historical-coverage checkpoints. Review false positives and false negatives.
- Version the benchmark cohort, sources, dates and results. Publish numerical labels only after evidence-based threshold review.
- Record every proposed threshold adjustment in a separate review; do not silently change approved weights.

## Release
No claim of calibrated score or successful deployment until tests, benchmark and preview acceptance complete.
