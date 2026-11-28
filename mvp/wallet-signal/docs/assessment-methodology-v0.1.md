# GLITCH Scanner — Assessment Methodology Draft v0.1

Status: PROPOSED / NOT CALIBRATED. This document does not authorize publishing a financial-risk score.

## Separate outputs

1. **Security risk findings**: evidence-backed observations about token permissions, concentration, liquidity, transfer controls and observed wallet behavior. Higher risk = more concerning. Do not use provisional 35/85 permission-control values as a calibrated score.
2. **Project quality**: independent assessment of creator history, documented utility, delivery evidence, transparency and tokenomics. No score until corresponding data and review criteria exist.
3. **Evidence coverage**: count verified, partial, missing and not-applicable checks independently. An incomplete scan is neither safe nor risky by default.

## Minimum release gates for a numerical security score

- Define the threat model and scope (technical controls versus trading, fraud or loss risk).
- For each check document raw fields, provider, observation timestamp, freshness requirement, parsing status, classification exclusions and provenance links.
- Token-2022 controls must be distinguished from ordinary SPL tokens. Non-applicable extensions must not be counted as missing.
- Classify pools, custody, vesting and treasury accounts before interpreting holder concentration as ownership risk.
- Verify liquidity reserves, pool controls and executable depth; provider-reported USD liquidity alone is insufficient.
- Distinguish launchpad creator, fee payer, mint authority, metadata authority and beneficial owner. Attribution does not prove good/bad creator behavior.
- Define thresholds against labeled, independently reviewed samples and measure false positives, false negatives and missing-data effects.
- Ensure the same evidence gives the same result. Provide tests for adversarial, incomplete, stale and conflicting data.
- If minimum gates are not met, show **Assessment incomplete**, top findings, evidence coverage and actionable next checks, not a numerical safety verdict.

## Proposed UI ordering

1. Top three prioritized findings (cautions first; observations next).
2. Evidence coverage: verified / partial / missing / not applicable.
3. Per-attribute verdict, explanation, evidence source, freshness and next check.
4. Detailed raw on-chain records behind expandable sections.

## Release acceptance

- Unit tests and Next.js build pass in CI.
- Test against diverse real Solana tokens, including SPL, Token-2022, Pump.fun, migrated pools, missing-history and verified creator cases.
- Compare GLITCH output against independent chain evidence and competing scanners, documenting disagreements.
- Mobile and desktop review verifies clarity, loading states and absence of unsupported certainty.
- Owner approves merge and deployment separately.

Current implementation: provisional attribute control scores remain in the existing code and must not be represented as an overall safety score. The consolidatedScore field intentionally remains null.
