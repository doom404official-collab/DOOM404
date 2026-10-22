# H06 — Pump AMM pool infrastructure classification proposal

Status: PROPOSED / READ_ONLY / NO SCORE PROMOTION
Date: 2026-10-22
Snapshot: 1379bcb43b07be4b783dd4aa67bcabab50cc363cf36c4ca31c943204ccda0153
Methodology: TOP20_NETWORK_V1 (unchanged)

## Proposed classification
Treat 6e3jZLtf4tQbWZm3f7A66jF8tfZn6MRQVrbDFgcNWarA as a historically corroborated Pump AMM pool/infrastructure account in a versioned, **unpromoted** exclusion proposal, rather than an independent holder.

## Positive evidence
- Alchemy archive read-only run 39730887081: owner/discriminator match at slots 450097547, 451211747 and 457305617; context slots match requests; 301-byte pool state with distinct SHA256 hashes.
- Alchemy archive read-only run 39734447423: decoded base mint 98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump, quote mint So11111111111111111111111111111111111111112, LP mint CWQgvR86mZPz5bmFGx8HF137yoqzMfGQWdFM1X7xhZ1G, base vault F1Gw5qjivGuLcTsUBeq7ztzE4mi9uaDm7vQdz9sB9mp8 and quote vault 78nPA3tUEH4b2jZjH1JKdqXjykYWzA7Az37CeKj1tTcg at all three slots. Historical vault token owner authority equals pool; mint identities match.
- Counterpart audit 39628746349: two wrapped-SOL transfers involving quote vault and temporary token account owner GHceWgs54Ye6iQCdk2orLgvSweaNsNa57qxaJBjAg7gA.
- Diab CPI and vault observation 39723132012 and 39725944379: separate later transaction; no inner instructions and no net vault balance movement; do not use it as proof of earlier transfer operation.

## Sensitivity only — not production scoring
Cross-job observations from two separately updated checkpoints (2026-10-22 06:10:01 and 06:10:57 UTC): 30,415 raw, 23,963 deduplicated transfers; 4,695 undirected pairs; 8 high-degree hubs.
- Baseline observed network: 9.93/35, connected holders 13, direct pairs 19, repeated pairs 9, largest cluster 22.33%.
- Excluding pool: 14.04/35, connected holders 12, direct pairs 12, repeated pairs 7, largest cluster 16.25%.
- Difference: +4.11 score points and -6.08 percentage points in largest cluster.
- Earlier 8.97/35 score is from another evidence checkpoint; not directly comparable.

## Acceptance still required
1. Independently execute the checked-in `compareHolderInfrastructureExclusion` function on an immutable, consistently captured pair of jobs and compare every score/penalty to the SQL-derived sensitivity.
2. Verify Alchemy Account Archive provenance and historical exact-slot semantics for the configured endpoint; probe still says `historicalStateVerified:false`.
3. Reconcile the other three counterpart transfers by instruction-level roles without inferring common ownership.
4. Review fixed-20 versus replacement-holder policy for a pool exclusion; do not silently re-rank the frozen top 20.
5. Review and explicitly approve any future scoring population change. Do not edit Snapshot #2, checkpoints, TOP20_NETWORK_V1, or production.

Proposed decision: `POOL_INFRASTRUCTURE_CANDIDATE_CONFIRMED_AT_OBSERVED_SLOTS / EXCLUSION_PROPOSED_NOT_PROMOTED`.
