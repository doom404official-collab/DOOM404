# GLITCH Scanner — parallel delivery tracks

## Track A: Token Assessment Engine (independent of creator verification)
Goal: deliver actionable token assessments from independently observable evidence even when creator attribution is unavailable.

### A1 — Scope and coverage
- Preserve the five existing attributes: token permissions, token-account concentration, transfer-fee controls, liquidity resilience, creator attribution.
- Creator attribution must remain optional for a token-controls assessment.
- Never treat missing evidence as safe, zero risk, or a zero score.
- Separate observed concern from evidence coverage and show both prominently.
- Display top three findings with evidence, impact, and next investigation step.
- Treat token-account concentration as account-level, not beneficial ownership.
- Explicitly distinguish Token-2022 not-applicable transfer fees from unverified fees.

### A2 — Scoring gate
- Define a separate token-controls score based only on reliably assessed applicable controls.
- Do not extrapolate to overall token quality, fraud probability, or investment safety.
- Use an explicit eligible-attribute denominator, coverage threshold and versioned weights.
- Withhold any numeric score when too few applicable attributes are verified; retain qualitative findings.
- A creator-unknown token must still receive all eligible token-only assessments.

### A3 — Tests
- Missing creator + complete token controls.
- Missing mint/freeze fields must never imply revoked.
- Missing liquidity, stale provider data, and unavailable holder history.
- Standard SPL vs Token-2022 extension applicability.
- Established issuer (USDC) vs permissionless meme token; centralization must not equal scam.
- Identical token controls with verified vs unknown creator should not change token-only score.

## Track B: Creator Intelligence (launchpad-specific)
Goal: reproducible launch creator attribution and subsequent behavioral evidence.

### B1 — Supported
- Pump.fun versioned decoder with on-chain transaction evidence.
- Persisted match for one known test mint; independent external review pending.

### B2 — Expand
- Implement and validate Raydium LaunchLab instruction decoding using official IDL and real creation fixtures.
- Investigate StonkFun's official program, account layouts and transaction availability before registering a decoder.
- Distinguish launchpad creator, mint authority, fee payer, metadata update authority, and beneficial owner.
- Provider metadata (Solscan) is candidate evidence only, not proof of the creation role.
- Do not promote creator status when the provider is unavailable or reports conflicting identities.

### B3 — Creator behavior
- After role attribution, analyze wallet-level holdings, transfers, swaps and previous launches.
- Distinguish direct holdings from linked-wallet hypotheses; classify swaps vs transfers.
- Record sample window, missing history, provider source and transaction references.
- Do not infer malicious intent from a sale or from a single historical launch.

## Parallel execution and release gates
- Work only on feature/glitch-assessment-sprint1 or isolated feature branches.
- Track A can ship before Track B; creator attribution must not gate token-only insights.
- Tests must pass and preview must be manually reviewed on mobile and desktop.
- No Supabase mutations, paid provider changes, merges or production deployment without approval.
- Independent reviewer/provider corroboration remains a separate verification milestone.
