# GLITCH Holder Network — evidence validation gates

Status: engineering plan; no score release authorized.

## Current observed baseline (15 October 2026)
- Mint: `98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump`
- 20 holder histories reached, but historical coverage remains incomplete.
- 684 signatures discovered, 360 checked, 324 pending; 1 wallet provider-exhausted.
- 9 candidate edges connecting 8 wallets in one group; 15.4943% combined observed share.
- Data source: `public.glitch_holder_scan_jobs.summary` and `.checkpoint`.

## Required validation before score or public labels
1. For each edge, retrieve the referenced on-chain transaction and verify both wallet addresses participate in a relevant movement. Differentiate direct SOL transfers, SPL token transfers, co-signing, shared counterparties, and incidental co-occurrence. Co-occurrence alone is **not** a direct transfer.
2. Record transfer direction, token mint, raw amount and decimals, slot/time, source and destination owners, program, signature and decoding provider. Deduplicate signatures across edges.
3. Exclude or label infrastructure, pools, aggregators, program-controlled accounts and other non-independent entities when evidence supports it.
4. Keep `unverified`, `verified_interaction`, `verified_transfer`, and `rejected` states separate. Do not infer common ownership, personal acquaintance or manipulation from a transfer alone.
5. Store source evidence and a decoder version. Add second-provider corroboration when possible; preserve unknowns.
6. Track per-wallet pagination cursors, provider exhaustion, discovered/checked/pending signatures and retry failures. Do not equate wallets reached with archival completeness.
7. Compute connected holder share only from deduplicated owner wallets and a consistent balance snapshot; identify excluded system wallets and uncertainty.
8. Gate the consolidated Holder Structure score until minimum evidence and coverage thresholds are defined and tested. Show a provisional network view with coverage warnings before then.

## Worker acceptance tests
- A run resumes from the persisted checkpoint without resetting counters.
- Concurrent invocations cannot both own the same database lease; GitHub workflow concurrency alone is not sufficient across workflows or environments.
- Retry only bounded transient failures; respect provider limits and a maximum tick/request budget.
- Stop when `complete`; do not restart automatically; halt and surface `failed` and unexpected statuses.
- A wallet history is complete only when provider exhaustion or an explicit documented historical cutoff is established and all eligible discovered transactions are resolved.
- Verify repeated signature processing does not create duplicate edges.

## Release gates
- Audit and classify all 9 current candidate edges against on-chain transaction evidence.
- Reconcile prior 8-pair investigation with current 9 edges by wallet pair and signature.
- Finish or clearly disclose incomplete historical coverage.
- Build bubble map with wallet nodes, labeled edge types, signature evidence and snapshot holdings.
- Add attribute-level Holder Structure verdict and consolidated scoring only after validated methodology.
