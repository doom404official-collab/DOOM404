# H06 — Remaining three historical WSOL counterpart roles

Status: OBSERVED_ONLY / UNRESOLVED
Source: existing GitHub Actions 39628746349 (read-only counterpart audit); no additional RPC.

Historical transaction: 37WZYkLnwzcPmYdoydTRhYAoUAcFGwHYem3QGt6exoSqt8H2SCZZuB5uUZg3Dd9NyTjYr62nhaxT2VbMELDKocA6, slot 450097547.
Source token account: 6DgMfbDmjbGT9knSgztDg7Fg813mwjw2Bz5ieBztqDju, initialized in transaction with authority GHceWgs54Ye6iQCdk2orLgvSweaNsNa57qxaJBjAg7gA.
- Inner [6,3] to 78nPA3tUEH4b2jZjH1JKdqXjykYWzA7Az37CeKj1tTcg: historical Pump AMM quote vault, pool authority 6e3jZLtf4tQbWZm3f7A66jF8tfZn6MRQVrbDFgcNWarA, independently corroborated by Alchemy historical pool/vault audit 39734447423.
- Inner [6,4] to X5QPJcpph4mBAJDzc4hRziFftSbcygV59kRb2Fu6Je1: balance-metadata owner 7hTckgnGnLQR6sdH7YkqFTAA7VwTfYFaZ6EhEsU3saCX; operation role unresolved.
- Inner [6,5] to EFikfamGR5RwvVXWAgekcpcNEZnccmgAQjWASYnNSzG: balance-metadata owner HGBJMtxiFXSkZRk838n5mmHwvRtribAUdCAT1gyoYzSd; operation role unresolved.
- Inner [6,6] to HjQjngTDqoHE6aaGhUqfz9aQ7WZcBRjy5xB8PScLSr8i: balance-metadata owner 5YxQFdt3Tr9zJLvkFccqXVUwhdTWJQc1fFg2YPbxvxeD; operation role unresolved.
- All three recipient owners absent from frozen top-20 holder ranking; they are not direct eligible top-20 pairs.
- Their fee/settlement roles are NOT established by ownership metadata alone. Do not classify as protocol fee, creator fee, swap, or common ownership without ordered instruction context, fee-account authority and transfer amounts.

Next: focused read-only transaction role audit for the single existing signature, including outer instruction program ID, decoded operation, inner transfer amounts and account roles; verify against historical Pump AMM config/fee recipient evidence. No score promotion, checkpoint mutation or production changes.

## Accepted parent-operation result (2026-10-22)
- GitHub Actions 39742090414 succeeded.
- Slot 450097547, outer instruction 6: Pump AMM discriminator c62e1552b4d9e870, `buy_exact_quote_in` candidate, 26 instruction accounts.
- The three WSOL transfers at inner indices 3,4,5 (as separately indexed by the role audit 39740757340) occur beneath that successful buy instruction.
- Their role is `BUY_INSTRUCTION_ASSOCIATED_DISTRIBUTION`; do not assert protocol-fee / creator-fee / referral-fee labels or authorization until historical config and account-layout checks establish them.
- No additional general transaction or CPI audit required for this signature.

