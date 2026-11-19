# GLITCH Real-Token Acceptance Matrix — Sprint 1

Status: TEST PLAN ONLY. No live token has been verified by this document.

## Candidate cases (resolve mint, program, and expected properties independently before testing)

1. Established Solana SPL token: select a widely traded SPL mint with independently verifiable authorities and liquidity.
2. Recent Pump.fun token: choose a recent launch with an accessible creation transaction and inspect launchpad-designated creator separately from fee payer.
3. Concentrated token: choose an independently confirmed high-concentration mint; classify pool/custody/treasury accounts before interpreting ownership.
4. Token-2022 token: select a mint with independently verified extension configuration; inspect transfer-fee and relevant authorities.
5. Incomplete creator evidence: choose a mint where earliest creation evidence is unavailable, and ensure GLITCH does not fabricate attribution.

## Per-case procedure

- Record mint address, chain, program ID, token age, UTC test time, data providers and scan URL.
- Capture GLITCH output: each verdict, evidence status, top-three findings, source links, errors, response time and mobile/desktop screenshots.
- Independently verify mint/freeze authorities from parsed mint account; compare Token-2022 extension data with on-chain state.
- Verify creator origin via launch instruction/transaction signature where available; label role and confidence.
- Cross-check largest token account and any known pool/custody classification; do not equate account with beneficial owner.
- Cross-check reported liquidity and limitations against pool reserve/control evidence.
- Record any discrepancy with source links, severity, root cause, owner and remediation status.

## Acceptance criteria

- No fabricated creator identity, transfer fee, liquidity guarantee or safety score.
- Missing fields never result in a positive safety conclusion.
- Top findings accurately prioritize supported cautions, with clear next checks.
- Creator verification and creator behavioral history remain distinct.
- Every assessment includes provenance and evidence coverage.
- Mobile and desktop render without overlapping controls or hidden primary actions.
- Repeat scans with unchanged underlying evidence give consistent verdicts.

## Results template

| Case | Mint / program | GLITCH verdict | Independent evidence | Discrepancy | Outcome |
|---|---|---|---|---|---|
| Established SPL | TBD | Not run | Not collected | TBD | Pending |
| Recent Pump.fun | TBD | Not run | Not collected | TBD | Pending |
| Concentrated token | TBD | Not run | Not collected | TBD | Pending |
| Token-2022 | TBD | Not run | Not collected | TBD | Pending |
| Incomplete creator | TBD | Not run | Not collected | TBD | Pending |

Do not infer a pass from a successful build alone. Require actual deployed-preview tests and independently corroborated chain evidence before release.
