# DOOM404 // GLITCH Risk Intelligence v1

Status: development specification — experimental, not a validated scam detector.

## Product outcome
Answer three distinct questions:
1. What observable wallet behavior warrants investigation?
2. Which on-chain transactions or verified threat sources support each finding?
3. How much relevant history was actually examined?

## Non-negotiable rules
- Never call a wallet owner a scammer based on heuristics alone.
- Never describe a wallet as safe merely because no indicators were found.
- A score is a **wallet behavioral risk indicator**, not a credit score, financial recommendation, or identity verification.
- Separate *verified threat association* from *heuristic anomaly*; show source and timestamp for verified labels.
- Missing RPC data, decoding failures, sampling or rate limits must reduce confidence, not improve a score.
- Do not calculate a numeric risk score if the minimum evidence gate fails.
- Keep GLITCH and wallet overview evidence accessible when any module fails; show incomplete assessment status.

## Proposed v1 assessment response
```json
{
  "version": "glitch-risk-v1",
  "assessmentStatus": "experimental|insufficient_evidence|unavailable",
  "riskScore": null,
  "riskBand": "low_observed|moderate|elevated|high|not_assessed",
  "confidence": "low|moderate|high|insufficient",
  "coverage": {
    "historyComplete": false,
    "observedTransactions": 0,
    "decodedTransactions": 0,
    "failedDecodes": 0,
    "earliestObservedTimestamp": null,
    "latestObservedTimestamp": null,
    "paginationExhausted": false
  },
  "findings": [],
  "limitations": [],
  "methodologyVersion": "1.0.0"
}
```

Each finding requires `id`, `category`, `severity`, `classification` (verified association or heuristic), `explanation`, and an array of transaction signatures or documented external source references. A finding with no supporting evidence is not published.

## Scoring design — provisional
- Verified malicious counterparty association: up to 40 points (only with reliable source and chain evidence).
- Unusual velocity or rapid dispersal: up to 20 points, compared against an explicit baseline.
- Fund concentration or circular-flow patterns: up to 20 points, with amounts and signatures.
- Repeated suspicious interaction patterns: up to 20 points, with clear definitions.
- Cap at 100; no points awarded for missing evidence.
- Do not infer malicious intent from transfers, new wallets, high volume, token trading, or age alone.
- Thresholds and weights must be calibrated using labeled historical datasets before public risk-score launch.

## Evidence gate
Numeric scoring remains disabled until minimum transaction count, lookback coverage, successful decode rate, and RPC reliability thresholds are implemented and empirically validated. Until then show **Experimental risk indicators — not assessed** or **Insufficient evidence**.

## Complete transaction history
Provide server-side cursor pagination, deterministic ordering, date/type/status filtering and export of retrieved pages. Never claim complete history until the RPC provider reaches chain-history exhaustion. For large wallets use asynchronous export rather than one long browser request. Explicitly show `loaded / known or unknown total` and API coverage limitations.

## Acceptance tests
1. No-history wallet -> insufficient evidence, no numeric score.
2. Partial RPC coverage -> confidence reduced, no false safe verdict.
3. One flagged transfer without verified malicious label -> heuristic only, not a scam verdict.
4. Verified label -> source, retrieval time and relevant transaction evidence shown.
5. RPC 429 or decoder failure -> incomplete assessment, no fabricated finding.
6. History pagination -> no duplicate signatures, stable cursor and export counts.
7. Changing address -> clears prior assessment.
8. No secret API key exposed to browser or logs.

## Rollout gates
1. Build historical pagination and coverage instrumentation.
2. Implement typed findings and confidence engine.
3. Validate on benign and labeled malicious datasets; measure false-positive rate.
4. Add user-facing risk panel with evidence drill-down and shareable report.
5. Only after validation, consider public numerical risk scores and ongoing monitoring.

Deployment, merge, and public launch require explicit approval.
