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
