# GLITCH Scanner — Authoritative Four-Attribute Framework v1.1
Status: APPROVED PRODUCT SPECIFICATION (2026-10-17). Supersedes earlier attribute naming, component allocation and proposed overall weighting for the GLITCH Token Analysis score. Does not retroactively certify old numerical outputs, complete evidence coverage, or authorize displaying uncalibrated financial-safety verdicts.

## Overall structure
Four independent 0–100 dimensions, equal 25% contribution when all required evidence is verified:
- Token Security (S)
- Holder Intelligence (H)
- Creator Intelligence (C)
- Liquidity Quality & Safety (L)
Overall = (S+H+C+L)/4. Withhold overall score if any required dimension is incomplete. Display verified findings, unknowns, timestamps and evidence coverage separately.

## 1 Token Security — 100 points
- Transfer fee schedule: 25. Effective fee: 0%=25; >0–1%=20; >1–3%=12; >3–5%=5; >5%=0. Verify current epoch, basis points, max fee, transfer behavior.
- Fee configuration authority: 25. Revoked=25; active unrestricted=0; unknown=unscored.
- Mint authority: 25. Revoked=25; active unrestricted=0; unknown=unscored.
- Freeze authority: 25. Revoked=25; active unrestricted=0; unknown=unscored.
- Largest token account REMOVED from Token Security; assess ownership under Holder Intelligence only.
- Standard SPL without Token-2022 fee extension: fee schedule and fee configuration are NOT APPLICABLE, not unknown; normalize applicable max (typically 50) to 100. Applicable checks missing evidence must withhold final score. Additional Token-2022 controls (e.g. delegate/hook) remain explicit critical flags, not silently treated as safe by these four checks.

## 2 Holder Intelligence — 100 points
- Top-20 Holder Concentration: 35.
- Connected-Wallet Network: 35. Preserve existing verified direct/repeated/indirect/largest-cluster penalty engine; do not replace with old 10-point density model.
- Creator/Team Exposure: 20. Proposed full at <=1% verified linked supply, linear to zero at >=20%; incomplete attribution => unscored.
- Holder Breadth & Independence: 10. Verified independent top-20 wallets; do not treat missing historical transfers as independence.
Top 20 only. Any verified SOL or token transfer between two holder wallets counts as a connection; it is NOT proof of common beneficial ownership. Exclude verified infrastructure wallets appropriately. Use mint total supply and dated snapshots. Avoid double counting cluster penalties. Remaining 35/20/10 sub-formulas require calibrated, versioned implementation before final publication.

## 3 Creator Intelligence — 100 points
- Creator Identification: 20; verified launch creator and provenance = 20, unknown = unscored.
- Creator Holdings: 20; full at <=2% attributable supply, linear to zero at >=20%.
- Creator Selling: 30; 10 each for verified cumulative sell-through at 1h, 24h, 7d; 0 for each window at >=50% sell-through; no verified sales only counts as zero sold if history window complete.
- Previous Launches: 30; 10 for historical early selling, 10 for creator-controlled liquidity withdrawals, 10 for comparable launch consistency. No prior launches is not evidence of good or bad behavior.
Transfers are not sales; separate deployer, fee payer, authority and beneficial owner. Behavioral thresholds are proposed and must be benchmarked before publishing numerical ratings.

## 4 Liquidity Quality & Safety — 100 points
- Available Liquidity: 25; 0 at <=$10k and full at >=$250k verified executable liquidity.
- Liquidity-to-Market-Cap Ratio: 20; 0 at <=2%, full at >=20%.
- LP Security: 25; independently verified LP custody, lock/burn and withdrawal rights, not provider estimates alone.
- Liquidity Concentration: 10; assess independent usable pools/providers.
- Trading Impact: 10; full at <=1% sell impact, 0 at >=15%; reference trade min($1,000, 0.1% verified market cap), disclose size.
- Liquidity Stability: 10; 30-day verified reserves/withdrawals, adverse >=70% unexplained reduction zero.
Interpolate numeric thresholds linearly. Missing verified reserves, LP security or executable depth means incomplete, not safe.

## Display and release controls
- Proposed bands: 85–100 strong observed profile; 70–84 generally favorable; 50–69 mixed signals; 30–49 elevated concerns; 0–29 significant concerns. Not fraud probabilities or investment recommendations.
- Never impute unknown as zero or full points. Exclude only genuinely non-applicable checks and normalize.
- Every scored component needs source, timestamp, evidence coverage, methodology version and deterministic tests.
- Existing historical score implementations are legacy until migrated and reconciled; do not present their outputs as v1.1.
- Production activation gate: complete implementation, unit/integration regression tests, representative-token calibration, preview acceptance, then deploy. Preserve all historical evidence and snapshots; supersession is methodological, not deletion.
