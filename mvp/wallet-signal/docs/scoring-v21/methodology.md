# Overall observed risk methodology 2.1.0 — 27 November 2026

The owner authorized overall weights of Security 15%, Holders 30%, Liquidity 35%, Creator 20%. `lib/riskMethodology.mjs` is the canonical current aggregation contract. The same weighted sum applies to observed risk and coverage. Inputs retain the existing attribute 2.0 formulas and component weights. The historical 1.1 framework and 2.0 equal-weight reports remain historical; never compare them without methodology labels or identical-evidence replay. Schema versions identify evidence shape, separately from `methodologyVersion`.

Missing criteria add no observed adverse points and never change the fixed denominator. They do not establish actual zero risk. Zero-coverage attributes display Not assessed. The existing overall numerical display threshold (60% overall, 65% Security) and bounded-assessment eligibility (80% overall, every attribute at least 50%, Security and Liquidity 100%) remain unchanged. The revised weights lower coverage for several quote-only/creator-unassessed tokens; this is intentional. No eligibility weakening was applied.

Existing calibrated critical severity is preserved, with a visible alert in the Overall scoreboard and critical findings first in the top-three insights. No score floors, multipliers or age penalties were added. Unresolved creator disposition is a high material-evidence flag, not a critical malicious-activity conclusion. Privileged-control and concentration labels remain distinct.

Maturity uses only transaction-local verified mint creation proof, signature, slot and timestamp. Intervals: [0,1 hour), [1 hour,24 hours), [1 day,7 days), [7 days,30 days), [30 days,90 days], (90 days,infinity). The basis explicitly distinguishes mint age from unestablished trading start. No trustworthy proof means Maturity not established. Older tokens receive no safety credit.

## Creator and holder corrections

Nine transactions represented creation plus eight recent prioritized transaction reads. The initial bounded pass remains asynchronous. A verified launch purchase of at least 1% of observed supply triggers one exact current-wallet inventory read; direct holdings below 1% of that purchase trigger one indexed page of at most 12 earliest launch token-account transactions (wallet fallback). This targets economically material issuance exposure rather than dust, preserves the existing total 18 RPC and 34-second execution ceilings, and never paginates. Cached verified event identities are reused and deduplicated. Unsupported transaction classification remains unresolved. The 1%/99% trigger is an enrichment policy, not an extra score component; it is deliberately sensitive to near-total disappearance of a material purchase and does not claim lifetime balance reconciliation.

A qualitative unresolved-disposition flag requires material purchases, negligible verified current holdings, and recovered disposals insufficient to explain the observation. No 'missing balance' amount is manufactured by subtracting unrelated partial aggregates. Exact current raw holdings remain visible even when percentage formatting rounds to zero. Zero recovered sales does not prove absence of sales.

Holder relationship evidence previously required an identical wallet set to the independently refreshed concentration sample; legitimate bounded evidence could therefore disappear from the display. A fresh independent relationship snapshot now retains its own supply, balances, slot and scope. It is never blended into the concentration snapshot. Status distinguishes not investigated, in progress, unavailable, bounded negative observations and material relationships. History-completeness coverage is unchanged; bounded negative observations do not prove independence or grant full historical coverage.

## Calibration

`calibration.json` replays all 15 final-browser rows from the accepted closure report using identical attribute outputs. It contains no new provider calls. Several rows lack retained age/flag detail; those fields explicitly remain unavailable rather than fabricated. The matrix includes supported and unsupported liquidity, standard SPL and Token-2022, privileged controls and concentrated holders; it does not establish statistical fraud prediction. Owner reference inputs are independent deterministic fixtures and can differ from later market snapshots.

Weights increase the contribution of liquidity and concentration, decrease the numerical contribution of privileged controls, and do not inflate every score. Critical display overrides are essential: isolated Security 100 yields 15, Liquidity 100 yields 35, Holder 100 yields 30, Creator 100 yields 20. Numerical results alone are never safety classifications. USD stablecoin controls are permission exposure, not issuer fraud claims.

No database schema, provider policy, billing, credentials, checkpoint, production gate or production deployment changes are part of this release.
