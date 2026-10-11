# DOOM404 — Wallet & Creator Behavior Intelligence (design specification)

Status: Proposed, not yet implemented. No creator verdict or risk score may be presented as verified without supporting indexed on-chain evidence and validation.

## Two investigation modes
1. **Wallet Behavior:** user enters a wallet; analyze decoded native SOL and SPL transfers, swaps, counterparties, age, time patterns, token exposures, source coverage, and links to verified threat intelligence. Separate exchange/market-maker/bot patterns from user-controlled wallets where possible.
2. **Token Creator Behavior:** user enters a Solana token mint; resolve verified mint authority, launch/deployer wallet, Pump.fun creation metadata where applicable, initial allocation, and associated wallets with attribution confidence. Distinguish token deployer, mint authority, fee recipient and beneficial owner; they may differ.

## Creator history metrics
- Enumerate verifiably attributed historical launches; include chain, mint, timestamp, and provenance.
- Track creator's **attributable initial allocation**, buys, sells, transfers, and current holdings for each token. Transfers are not sales. Unknown ownership of recipient wallets must remain unknown.
- **Holding time**: calculate lot-level acquisition-to-disposal intervals for confirmed sales, with a documented FIFO convention. Display median, mean and distribution. Undisposed lots are right-censored and shown as *held for at least N days*, never assumed sold. Separately calculate launch-to-first-sale and launch-to-50%-sold.
- **Creator sell-through**: percent of attributable tokens sold in 1h, 6h, 24h, 7d, 30d windows, with denominators and coverage.
- **Realized proceeds**: SOL/USDC from verified swaps/sales, excluding unrelated transfers and fees; distinguish token price movements from realized profit.
- **Liquidity actions**: separately classify creator-controlled liquidity addition/removal where decoded and attributable.
- **Linked wallets**: show funding paths, synchronized timing and transfer trails with evidence and attribution confidence; never assert common ownership based solely on one funding link.
- **Repeated launch patterns**: compare each launch using identical observation windows, avoiding bias from newly launched tokens.

## Decision report
Report factual findings first: e.g. "6 of 8 attributed launches had a verified creator sale within 24h." Attach exact mint addresses, transaction signatures, dates, methodology and coverage. Then explain what the pattern might mean and what a trader can verify next.
Use **Observed early selling**, **Insufficient data**, **No early selling observed within checked coverage**, not "Scammer", "Rug", "Safe", or "Long-term visionary" as automatic verdicts.
A creator may have legitimate reasons to sell or move tokens. A long holding period does not prove good intent.
No numerical trust/risk rating until ground-truth evaluation against known malicious and ordinary launches with measured false positives.

## Data requirements and implementation gates
1. Provider/indexer supporting historical Solana signatures and parsed transactions, token balance deltas, DEX swaps, Pump.fun events and archival backfill.
2. Deterministic transaction normalization, mint/deployer attribution and per-token position accounting; preserve raw evidence references.
3. Unit tests for transfers vs swaps, wallet-to-wallet movements, partial sales, multiple lots, self-transfers, fee deductions, missing data, censored holdings, and pagination.
4. Validate against diverse manually reviewed creator histories and publish confidence/coverage.
5. Only then surface creator behavior insights inside the DOOM404 Trust Report; keep existing fast wallet scan independent of potentially slow creator history backfill.

## Proposed milestones
- CB-01: token mint lookup + creator provenance, explicit unknowns.
- CB-02: creator holdings ledger + verified sale timing.
- CB-03: multi-launch creator history + median holding time.
- CB-04: connected-wallet investigation with confidence tiers.
- CB-05: user-facing comparative creator report + evidence links.
- CB-06: benchmark, alerts and validated classifications.

Security: RPC/API secrets remain server-side; rate-limit requests; avoid claims of complete archival coverage unless verified.
