# Holder Intelligence — single completion register (22 October 2026)

Scope: frozen Snapshot #2, TOP20_NETWORK_V1, test mint 98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump. No score promotion, checkpoint reset, production deployment or main merge.

## Operating rules
- One authoritative checklist; never repeat an accepted diagnostic without new contradictory evidence.
- CI pass != on-chain verification; provider exhaustion != archive completeness.
- Do not sum overlapping job counts; deduplicate by signature and transfer identity.
- Keep evidence observed-only until classification and coverage gates pass.
- Only mark DONE with reproducible evidence reference and acceptance result.

## Master gates
| ID | Workstream | State | Acceptance gate |
|---|---|---|---|
| H01 | Frozen top-20 ranking and supply snapshot | DONE | Snapshot #2 frozen at slot 457305617; 20 ranking entries |
| H02 | Network methodology restoration | DONE | TOP20_NETWORK_V1 tests and no changes to frozen methodology |
| H03 | Resumable worker and lease controls | IN_PROGRESS | Both live jobs complete or explicit documented bounded cutoff, safe restart/concurrency proven |
| H04 | Historical discovery and decoding | IN_PROGRESS | All discovered eligible signatures resolved; archive coverage separately proven or explicitly bounded |
| H05 | Transfer ownership evidence | IN_PROGRESS | Exact transfer-time owner, mint, account lifecycle, ordering and dedup established |
| H06 | Pool/infrastructure classification | BLOCKED | Historical Pump AMM owner/discriminator/vault mapping verified at relevant slots |
| H07 | Diab diagnostic | IN_PROGRESS | CPI sample complete; vault observation workflow not yet confirmed run; stop rerunning original CPI |
| H08 | Verified graph and exclusion sensitivity | BLOCKED | Read-only recomputation, infrastructure exclusions, pair/cluster and coverage reconciliation |
| H09 | Final network and consolidated score | BLOCKED | Independent validation, calibration and authorized promotion |
| H10 | Dashboard and bubble-map integration | IN_PROGRESS | Evidence-linked data, coverage caveats and responsive QA |
| H11 | Release readiness | BLOCKED | Preview E2E, security, monitoring, rollback and explicit production approval |

## Evidence pointers
- Counterpart audit: GitHub Actions 39628746349; five observed WSOL transfers at slots 450097547, 451211747.
- Diab CPI: GitHub Actions 39723132012; slot 458818672; innerInstructions present, zero groups and zero CPI; do not rerun.
- Vault observation helper commits 44b006c, 7b7e3d3; report script 9f2dd62; workflow registration 2e11c52; distinct vault workflow execution not yet confirmed.
- Supabase jobs c670f393-31b0-470c-a01f-cb2b813a1219 and d07c0256-b472-4089-a237-99ed5e5c8cc4 remain running at last query (2026-10-22 04:20 UTC).
- Snapshot #2 1379bcb43b07be4b783dd4aa67bcabab50cc363cf36c4ca31c943204ccda0153: pool candidate 6e3j... rank 1, GHce... rank 15; excluded_wallets only incinerator.
- Liquidity evidence snapshot 21 decoded candidate pool and vaults, but protocolVerified=false and historical state not authenticated.

## Next action — no duplication
1. Verify vault-observation workflow availability and execute only that distinct workflow once, after CI, with no old CPI rerun.
2. Inspect artifact: accountRoles, balances, innerMetadataState and transfer-level relevance; classify observed vs unknown.
3. Resolve exact historical pool-state proof or document provider limitation.
4. Continue worker to acceptance coverage; do not reset.
5. Read-only exclusion sensitivity; review separately before any promotion.

## Baseline
Observed score 8.97/35, connected holders 14, unique transfers 14112 are previously reported baseline, not independently recomputed in this checklist. Frozen Snapshot #2 and TOP20_NETWORK_V1 remain unchanged.
