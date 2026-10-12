# DOOM404 GLITCH Scanner — Master Requirements & Release Tracker
Updated: 2026-10-12
Status: Development planning; evidence-first. This tracker is not proof of production readiness.

## Product contract
Mission: Convert observable Solana wallet, token, creator and market evidence into clear, trustworthy decision support. Never output unsupported BUY/SELL commands, definitive scam labels, or identity claims.
User experience: Wallet Analysis and Token Analysis tabs. Scoreboard first; Top 3 insights; important flags; confidence and coverage; expandable evidence and source links. A missing source means **unknown**, not safe.
Scores: Token Quality and Market Integrity must be separately defined, calibrated, and tested before release. Never equate raw token-account concentration with unique beneficial-owner concentration.
Provider hierarchy: Solana RPC/Helius for on-chain evidence; DexScreener for labeled market estimates; Solscan optional. Authentication or archive failures must not block unrelated findings.
Privacy and trust: Never expose API keys. Community allegations must be distinguished from independently validated facts.

## Current status by requirement
Status meanings: IMPLEMENTED = code committed; PREVIEW OBSERVED = screenshots show feature; PARTIAL = significant scope missing; PLANNED = no verified implementation; BLOCKED = provider/data issue. Neither code nor screenshots replace automated acceptance tests.

| ID | Requirement | Status as of Oct 12 | Source/module | Acceptance criteria | Release |
|---|---|---|---|---|---|
| UX-01 | Wallet Analysis tab | IMPLEMENTED, needs acceptance | app/page.js | Mobile and desktop wallet checks pass | R1 |
| UX-02 | Token Analysis tab | PREVIEW OBSERVED | app/page.js | Valid/invalid mint tests and loading/errors pass | R1 |
| UX-03 | Scoreboard-first security summary | PREVIEW OBSERVED, PARTIAL | app/page.js | All cards accurate, accessible, mobile responsive | R1 |
| UX-04 | Top 3 insights and prioritized flags | PLANNED | new evidence synthesis | Deterministic, sourced, no fabricated findings | R1 |
| UX-05 | Evidence confidence/coverage labels | PARTIAL | API coverage fields | Every signal includes source, freshness, unknowns | R1 |
| TOK-01 | SPL and Token-2022 mint verification | PREVIEW OBSERVED | api/creator | Both programs and invalid inputs tested | R1 |
| TOK-02 | Mint/freeze authority checks | PREVIEW OBSERVED | api/creator | Revoked versus unknown distinguished | R1 |
| TOK-03 | Token-2022 extensions and fee schedule | PREVIEW OBSERVED | api/token-extensions | 0%, nonzero, transitions, unknown, authorities tested | R1 |
| TOK-04 | Largest token-account concentration | PREVIEW OBSERVED | api/token-concentration | Reconcile supply and account balances; no owner claim | R1 |
| TOK-05 | Verified owner concentration | PLANNED | indexed ownership resolution | Custody/pools/multiaccounts accounted for or unknown | R2 |
| LIQ-01 | Pool discovery and estimated USD liquidity | PREVIEW OBSERVED | api/token-liquidity | Pool links, timestamps, source coverage validated | R1 |
| LIQ-02 | Refresh liquidity independently | PREVIEW OBSERVED | app/page.js | Refresh updates timestamp without clearing other results | R1 |
| LIQ-03 | Pool identity/reserve validation | PLANNED | pool-specific on-chain checks | Verify pool program/address and reserves where supported | R1 |
| LIQ-04 | LP lock/burn/withdrawal evidence | PLANNED | protocol-specific checks | Unknown unless contract-specific proof obtained | R1/R2 |
| CRT-01 | Creator origin evidence | PARTIAL/BLOCKED | api/creator | Known-mint benchmark; signer never equated to creator | R2 |
| CRT-02 | Creator historical launches and holding time | PLANNED | indexed history | Source and time-window coverage; median and sample size | R2 |
| CRT-03 | Creator selling and connected wallets | PLANNED | behavioral analysis | No guilt-by-association; verifiable transactions | R2 |
| MKT-01 | Market Integrity Score methodology | PLANNED | design and scoring | Documented inputs, unknown handling, calibration | R1/R2 |
| MKT-02 | Token Quality Score methodology | PLANNED | design and scoring | Separate quality from fraud/safety; tested examples | R1/R2 |
| MKT-03 | Coordinated trading and bonding-curve signals | PLANNED | market intelligence | Evidence, false-positive handling, limitations | R2 |
| PRJ-01 | Project credibility and utility evidence | PLANNED | source verification | Unverified marketing claims labeled | R2 |
| COM-01 | Community Watch submissions | PLANNED | moderated workflow | Evidence references, dedupe, human review, appeal | R3 |
| COM-02 | Public validated reports, free for everyone | PLANNED | public safety feed | Verified evidence summaries accessible without paywall | R3 |
| COM-03 | Anti-abuse, reputation and fixed bounties | PLANNED | policy and controls | Sybil mitigation, funded rewards, legal review | R3 |
| AI-01 | GLITCH AI explanations and Q&A | PLANNED | separate release | Grounded citations, uncertainty, prompt-injection tests | R4 |
| OPS-01 | Preview-only change management | ACTIVE | feature/creator-origin-cb02e | No production merge/deploy without approval | All |
| OPS-02 | Automated build, unit, integration, regression tests | PARTIAL/NOT VERIFIED | CI to establish | Passing tests and reviewed Preview before release | R1 |

## Next development sequence (do not bypass acceptance gates)
1. **R1A — Stabilize Preview:** build succeeds; test refresh, responsive layout, no stale-data overwrite; add deterministic API fixture tests.
2. **R1B — Pool evidence:** validate largest returned pools with protocol-specific on-chain evidence; never claim LP locks from DexScreener estimates.
3. **R1C — Insight UX:** implement Top 3 evidence-backed findings, confidence/freshness, and explicit unknowns; retain technical details.
4. **R1D — Score methodology:** define Token Quality vs Market Integrity dimensions, weights, exclusions and unknown handling; do not ship a numeric score before calibration.
5. **R1E — Acceptance:** benchmark 5–10 tokens with known behavior; cross-check independent data; mobile tests; user approves merge.
6. R2 creator/behavior intelligence; R3 Community Watch; R4 GLITCH AI.

## Release gates
- Security: no credentials in source/client or logs; API inputs validated and provider errors handled.
- Accuracy: every displayed claim traceable to source and observation time; independent spot checks.
- Reliability: build, automated tests, responsive/mobile smoke tests; graceful provider outage behavior.
- UX: scoreboard first, Top 3 insights, flags, source links, no unsupported verdict.
- Governance: branch review and explicit owner approval before merge/deploy.

## Scope notes
The original litepaper is the authoritative long-term product vision; this tracker organizes MVP engineering delivery and does not amend tokenomics, funding gates or other litepaper commitments.
