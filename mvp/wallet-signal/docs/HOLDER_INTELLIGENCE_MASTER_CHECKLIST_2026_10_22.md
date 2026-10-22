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
| H06 | Pool/infrastructure classification | DONE | Evidence-based infrastructure classification accepted for 6e3j...NWarA at observed historical slots; scoring exclusion NOT promoted; exact fee-recipient authorization remains separate |
| H07 | Diab diagnostic | DONE | CPI and vault observations accepted for slot 458818672; zero inner instructions, both vaults owned by pool, unchanged pre/post balances; does not prove historical pool state |
| H08 | Verified graph and exclusion sensitivity | BLOCKED | Read-only recomputation, infrastructure exclusions, pair/cluster and coverage reconciliation |
| H09 | Final network and consolidated score | BLOCKED | Independent validation, calibration and authorized promotion |
| H10 | Dashboard and bubble-map integration | IN_PROGRESS | Evidence-linked data, coverage caveats and responsive QA |
| H11 | Release readiness | BLOCKED | Preview E2E, security, monitoring, rollback and explicit production approval |

## Evidence pointers
- Counterpart audit: GitHub Actions 39628746349; five observed WSOL transfers at slots 450097547, 451211747.
- Diab CPI: GitHub Actions 39723132012; slot 458818672; innerInstructions present, zero groups and zero CPI; do not rerun.
- Vault observation helper commits 44b006c, 7b7e3d3; report script 9f2dd62; workflow registration 2e11c52; successful vault workflow run 39725944379 (2026-10-22). Both vault owners match 6e3j..., raw balances unchanged, no inner instructions; H07 accepted.
- Supabase jobs c670f393-31b0-470c-a01f-cb2b813a1219 and d07c0256-b472-4089-a237-99ed5e5c8cc4 remain running at last query (2026-10-22 04:20 UTC).
- Snapshot #2 1379bcb43b07be4b783dd4aa67bcabab50cc363cf36c4ca31c943204ccda0153: pool candidate 6e3j... rank 1, GHce... rank 15; excluded_wallets only incinerator.
- Liquidity evidence snapshot 21 decoded candidate pool and vaults, but protocolVerified=false and historical state not authenticated.

## H06 archival-evidence audit (2026-10-22)
- Read-only SQL inspected all 21 liquidity_evidence_snapshots for the test mint, including nested JSON-path flags.
- No stored snapshot contains historicalStateVerified=true or authorizationVerified=true.
- Alchemy Solana Account Archive officially supports getAccountInfo with historical slot on paid plans (pay-as-you-go / enterprise), unlike ordinary Solana RPC. Validate the configured endpoint's entitlement and exact-slot response before accepting proof; never treat a generic RPC response as archival proof.
- No archive-state workflow run appeared in the most recent 100 GitHub Actions runs searched; this is not an exhaustive historical workflow search.
- Documented historical-state provider IDENTIFIED: Alchemy Solana Account Archive (https://www.alchemy.com/docs/solana/account-archive). H06 still blocked until account-specific entitlement, historical pool bytes, owner/discriminator, and vault provenance are validated. Do not claim H06 complete from present-day decoded pool data.

## H06 historical vault evidence (2026-10-22)
- GitHub Actions 39734447423 succeeded: 3 historical slots x pool/base vault/quote vault = 9 account reads.
- Pool owner and discriminator match Pump AMM at all three slots; base/quote mints, LP mint and vault mapping stable.
- Historical base vault Token-2022 and quote vault SPL owner/mint/authority corroborated at all slots.
- Returned context slots equal requested slots and account bytes hashes differ; probe still explicitly reports historicalStateVerified=false pending independent provider provenance acceptance.
- H06 now IN_PROGRESS, not blocked on account retrieval. Next: instruction-level role reconciliation, then read-only infrastructure-exclusion sensitivity. No score promotion.

## H06 transfer-to-vault reconciliation (2026-10-22)
- Reused existing counterpart audit 39628746349 and Alchemy historical vault audit 39734447423; no duplicate RPC.
- At slots 450097547 and 451211747, 78nPA3tUEH4b2jZjH1JKdqXjykYWzA7Az37CeKj1tTcg is the pool's historical quote vault (WSOL), token-account authority 6e3jZLtf4tQbWZm3f7A66jF8tfZn6MRQVrbDFgcNWarA.
- Transfers between 6DgMfbDmjbGT9knSgztDg7Fg813mwjw2Bz5ieBztqDju (owner GHceWgs54Ye6iQCdk2orLgvSweaNsNa57qxaJBjAg7gA) and the quote vault are pool-vault-mediated observations, not proof of common beneficial ownership.
- Do not classify these transfers as verified swaps, deposits, withdrawals or fee settlements without transaction instruction grouping and settlement corroboration.
- The other three counterpart transfers are not resolved as holder-to-holder links by this vault mapping.
- H06 next: read-only exclusion sensitivity for rank #1 with and without pool-node paths; preserve frozen ranking and existing score. Confirm provider historical provenance before declaring historicalStateVerified=true.

## H06 read-only sensitivity (2026-10-22)
- Supabase two-job evidence at checked checkpoint: 30,415 transfer records, 23,963 deduplicated by signature/from/to/assetType/mint/amountRaw; 4,695 undirected wallet pairs; 8 high-degree hubs (>100 peers).
- Frozen Snapshot #2 baseline: observed network score 9.93/35; 13 connected holders; 19 direct pairs; 9 repeated pairs; largest cluster 22.33%; penalties direct 10, repeated 5, indirect 0.5, concentration 9.57.
- Pool-excluded sensitivity (6e3jZLtf4tQbWZm3f7A66jF8tfZn6MRQVrbDFgcNWarA): observed score 14.04/35; 12 connected holders; 12 direct pairs; 7 repeated pairs; largest cluster 16.25%; penalties direct 8, repeated 5, indirect 1, concentration 6.96.
- Delta +4.11 score points, -1 connected holder, -6.08 percentage points largest cluster. Computed read-only from aggregated deduplicated pairs and frozen holder balances; independent script-output parity still required before acceptance. Historical coverage incomplete.
- Previously reported 8.97/35 belongs to an earlier evidence checkpoint, not the current comparison baseline. No score promotion or snapshot mutation.

## H06 application-scorer parity accepted (2026-10-22)
- GitHub Actions 39737554344 succeeded, executing checked-in TOP20_NETWORK_V1 comparator on Supabase jobs d07c0256 and c670f393.
- 23,963 unique transfers; parity flags baselineScoreMatches=true, excludedScoreMatches=true, transferCountMatches=true.
- Baseline observed score 9.93/35, 13 connected holders, 19 direct pairs, largest cluster 22.33%.
- Pool-excluded scenario 14.04/35, 12 connected holders, 12 direct pairs, largest cluster 16.25%.
- Delta +4.11 score, -1 connected holder, -7 direct pairs, -6.08 pp largest cluster.
- Source job timestamps 2026-10-22T06:58:54Z and 06:59:21Z; both running, historyComplete=false; no atomic snapshot guarantee.
- H06 scorer parity COMPLETE; H06 final classification still requires provenance acceptance, remaining counterpart role review, and explicit exclusion decision. No promotion.

## Next action — no duplication
1. H07 CLOSED. Do not rerun Diab CPI or vault observation without contradictory evidence.
2. H06: inspect existing historical pool-state evidence and provider semantics; seek authenticated account state at slots 450097547, 451211747 and 457305617, or record a documented archival limitation.
3. H04/H03: continue existing worker to acceptance coverage; do not reset.
4. H08: read-only exclusion sensitivity after infrastructure classification; review separately before promotion.

## Baseline
Observed score 8.97/35, connected holders 14, unique transfers 14112 are previously reported baseline, not independently recomputed in this checklist. Frozen Snapshot #2 and TOP20_NETWORK_V1 remain unchanged.

## H06 classification acceptance — 2026-10-22
- Decision scope: `HISTORICALLY_CORROBORATED_PUMP_AMM_INFRASTRUCTURE` for address 6e3jZLtf4tQbWZm3f7A66jF8tfZn6MRQVrbDFgcNWarA at observed slots 450097547, 451211747 and frozen slot 457305617. This is an evidence classification, NOT an official exclusion or score change.
- Account evidence: archive runs 39730887081 and 39734447423; historical Pump AMM program owner, pool discriminator, base/quote mint, LP mint, both vaults and token authorities match at each examined slot. Provenance caveat: probe field `historicalStateVerified:false` must be retained; Alchemy exact-slot archive semantics and matching historical hashes provide corroboration, not independently certified cryptographic state proofs.
- Transaction evidence: counterpart roles run 39740757340 and Pump AMM parent discriminator run 39742090414 establish successful `buy_exact_quote_in` at outer instruction 6, with three observed WSOL distributions under that instruction. Exact protocol/creator/referral fee categorization and historical recipient authorization remain unresolved and are NOT prerequisites for identifying the pool account as infrastructure.
- Observed exclusion sensitivity: application-scorer parity run 39737554344 reproduces baseline 9.93/35 versus excluded 14.04/35 on 23,963 deduplicated transfers; `historyComplete:false`, `scorePromoted:false`, `snapshotModified:false`. Earlier 8.97/35 is from a different checkpoint.
- Policy boundary: frozen top-20 ranking remains unchanged. Whether to exclude the pool while retaining a 19-eligible-holder set, or use a separately versioned replacement-holder policy, is a future H08/H09 approval decision. No automatic promotion.
- H06 DONE for infrastructure identification only. H08 remains blocked pending versioned graph policy acceptance and complete/defensibly bounded history; H09 remains blocked pending calibration, final scoring and approval. No further H06 RPC audits absent contradictory evidence.

