# Holder Intelligence — Pump AMM historical classification gate

Status: READ_ONLY / UNRESOLVED. No score promotion or snapshot mutation.

## Reused evidence
- Frozen Snapshot #2: 1379bcb43b07be4b783dd4aa67bcabab50cc363cf36c4ca31c943204ccda0153 (slot 457305617).
- Candidate pool: 6e3jZLtf4tQbWZm3f7A66jF8tfZn6MRQVrbDFgcNWarA; ranked #1 in frozen holder set, not explicitly excluded.
- Main owner: GHceWgs54Ye6iQCdk2orLgvSweaNsNa57qxaJBjAg7gA; ranked #15.
- Temporary WSOL account: 6DgMfbDmjbGT9knSgztDg7Fg813mwjw2Bz5ieBztqDju.
- Quote-vault candidate: 78nPA3tUEH4b2jZjH1JKdqXjykYWzA7Az37CeKj1tTcg.
- Transactions: 37WZYkLnwzcPmYdoydTRhYAoUAcFGwHYem3QGt6exoSqt8H2SCZZuB5uUZg3Dd9NyTjYr62nhaxT2VbMELDKocA6 at 450097547; 38AcrSYXmT32uPCupZdDfhp47mJCZgmBzitKHVZU83Xqa4MN8LcVuUpTzhQJhRZv48jexEbphL5b7WNYbjqNqMu at 451211747.
- Existing liquidity branch decoder: lib/pumpAmmPoolState.mjs; pool state requires Pump AMM program owner, discriminator and mint/vault corroboration.

## Historical RPC correctness warning
The existing app/api/liquidity-archive-state-verify/route.js passes a nonstandard `slot` field to Solana `getAccountInfo`. This does not prove that returned bytes reflect the requested historical slot. `minContextSlot` also does not provide historical reads. The endpoint already reports `historicalStateVerified:false`. Do not treat a matching context slot or decoded bytes as proof of account state at the earlier slot.

## Required independent verification
1. Obtain provider-documented historical account-state evidence at slots 450097547, 451211747 and 457305617 (or a verifiable historical transaction/account-state witness). Record provider method, response provenance, exact slot and raw bytes hash. If unavailable, leave unresolved.
2. Verify pool owner equals pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA and discriminator [241,154,109,4,17,177,109,188].
3. Decode baseMint, quoteMint, lpMint, poolBaseTokenAccount and poolQuoteTokenAccount; corroborate vault mint and token owner at the relevant slots. Candidate vaults F1Gw5qjivGuLcTsUBeq7ztzE4mi9uaDm7vQdz9sB9mp8 and 78nPA3tUEH4b2jZjH1JKdqXjykYWzA7Az37CeKj1tTcg are leads, not historical proof.
4. Decode outer/inner instruction order and Pump AMM program roles in the two target transactions; differentiate swaps, deposits, withdrawals, and fee settlements. Token transfer alone does not prove which.
5. Compare with frozen ranking and existing deduplicated transfer evidence; do not infer common control from pool-mediated transfers.
6. Produce an observed-only versioned exclusion proposal separately; do not edit Snapshot #2 or TOP20_NETWORK_V1, and do not promote scoring without approval.

No production deploy, main merge, checkpoint reset, or database write is authorized.
