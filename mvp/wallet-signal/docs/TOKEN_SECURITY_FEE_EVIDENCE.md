# Token Security transfer-fee evidence

This increment preserves v1.1 weights, thresholds and `calibrated: false`.

## Implemented

- Bracket the parsed mint account RPC with confirmed epoch observations. Account slot must fall between observation slots and both epochs must match. An epoch transition, missing observation, unsafe integer or malformed schedule leaves activation unresolved; extension presence can still be reported.
- Select older schedule before the newer activation epoch, and newer at or after activation. Report the observed epoch, context slots and observation timestamp, not a promise about a later transaction.
- Preserve epochs/caps/raw amounts as u64 decimal strings and calculate with BigInt. Reject already-rounded unsafe JavaScript numbers instead of manufacturing exactness.
- `calculateTransferFeeRaw(schedule, grossAmountRaw)` returns the exact decimal raw fee: `min(ceil(grossAmountRaw * basisPoints / 10000), maximumFeeRaw)`. Invalid input returns null. It requires an explicit gross amount; no default trade size is invented.
- Dashboard displays the resolved schedule and raw-unit cap, not the newer schedule unconditionally. Freshness/mint/verification checks gate fee evidence, including no-extension N/A and fee authority. Explicit null authorities are revoked; absent or malformed values are unknown.

## Deliberately still pending

The framework specifies effective fee and transfer behavior. Nominal basis points and an amount-dependent cap do not determine one universally effective percentage. This increment does not invent a reference transfer size or use the cap to silently change score thresholds. The transfer-fee scoring component therefore remains pending for fee-bearing Token-2022 mints until the approved methodology and transfer-behavior evidence supply its inputs. A resolved schedule is not a successful transfer simulation, hook execution, future fee guarantee, live persistence proof or calibration acceptance.

Freshness follows the existing one-hour evidence display boundary. Confirmed bracket observations are not an atomic multi-account transaction snapshot. Updates within the epoch can still occur after observation.

## Sources

- https://solana.com/docs/tokens/extensions/transfer-fees
- https://github.com/solana-program/token-2022/blob/main/clients/js-legacy/src/extensions/transferFee/state.ts (`getEpochFee`, `calculateFee`)

## Validation

Network-free regression tests cover older/newer activation boundary, epoch mismatch/failure, context-slot order, round-up and cap arithmetic, u64 maximum and >2^53 precision, malformed numeric fields and authorities, no-extension N/A, stale/undated/future and mint-mismatched evidence. API tests execute the actual GET handler against mocked RPC and Next response boundaries.

## October 29 local reconciliation — first Token Security slice

Canonical acceptance remains Issue #66, TS01–TS09, fixed denominator nine. Its
retained baseline is 4/9 accepted, not a new acceptance claim from this branch.
Read-only PR #67 metadata confirms draft/unmerged head
1a4cbf54e87fc0e81750a593cf1a821531255ab5 on assessment 5819522. Its two production
changes were absent from the recovery branch. This slice selectively incorporates
its normalized dashboard labels and literal-true engine gates, preserving the
later Holder/Liquidity dashboard work; no blanket merge or reference update.
The PR's actual JSX tests and frozen 6,912-case differential oracle are reused.

Two additional negative regressions failed after that incorporation: a literal
verified flag plus malformed authority could still produce revoked points, and a
malformed reported fee authority could render Revoked. The shared engine and fee
label now reuse normalizeMintAuthority: only explicit null is revoked, canonical
addresses are active, and malformed/missing values stay Unknown/Pending. Valid
input outputs match all 6,912 retained cases. The old test's placeholder `active`
was replaced by a canonical key, preserving its expected 50-point control case.
This was synthetic defect reproduction, not evidence of live score inflation.

| Gate | Retained status | Current implementation / remaining acceptance |
|---|---|---|
| TS01 | Accepted | Producer/adapter normalization reused; shared-engine boundary now also normalizes. |
| TS02 | Accepted | Epoch-bracketed schedule resolution unchanged. |
| TS03 | Accepted | Exact raw fee rounding/cap arithmetic unchanged. |
| TS04 | Accepted | Adapter identity/freshness/verification guards reused. |
| TS05 | Open | Reviewed draft label corrections incorporated locally; parent acceptance/integration remains pending. |
| TS06 | Open | Reviewed literal-boolean gates incorporated locally; malformed authority guard added; parent acceptance/integration pending. |
| TS07 | Open | Owner-approved effective-fee reference methodology for capped fees still required. No default trade size or nominal-fee score substituted. |
| TS08 | Open | Authentic verified transfer-behavior evidence unavailable; no live scan performed. |
| TS09 | Open | Independent real-token calibration acceptance remains Unknown; calibrated stays false. |

Largest Token Account is absent from the four-component Token Security score and
rendered tab. Its raw concentration data remains available for Holder use; this is
not authority to erase that evidence. Retired decision-summary helpers still exist
but the current page renders GlitchV11Dashboard, not the retired panels. No new
weights, thresholds, fee policy, verified behavior or final-score promotion.

No live RPC, hosted operation, route/workflow activation, push, CI dispatch or
Preview deployment is performed. Liquidity is parked separately at local 0c02bc5;
its 7/15 acceptance and original 87/60-signature lineage remain unchanged.

Validation: `node --test tests/token-security*.test.mjs
 tests/token-transfer-fee-evidence.test.mjs tests/mint-authority*.test.mjs
 tests/glitch-attribute-engines-v11.test.mjs` passed 46 tests. The unchanged
6,912-case valid-input differential oracle passed. Network-blocked npm run build
passed all 1,736 tests, Next compilation, lint and type checks; persistence stayed
SKIPPED_NOT_OPTED_IN. Two new negatives were observed failing before the fix.
One earlier full run failed only on the non-address `active` fixture; the final
full run passed with its canonical-key positive control. No hosted CI or Preview
status is claimed for this local-only commit.
