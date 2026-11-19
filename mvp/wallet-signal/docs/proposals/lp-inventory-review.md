# Top20 LP authority capture — offline candidate, not execution approval

Base: b47e1696faa4b34c6d503c52f9be9cc80d2811ea. Three-file candidate changes collector, focused tests and this review only. No workflow, runtime/scoring, checkpoint or credential changes.

## Fixed requests and admission
1. Exactly one getTokenLargestAccounts for CWQgvR86mZPz5bmFGx8HF137yoqzMfGQWdFM1X7xhZ1G with commitment finalized.
2. Only after valid context and at most20 distinct canonical account addresses, exactly one getMultipleAccounts for those addresses plus the same mint, finalized/base64 and minContextSlot equal to discovery slot. No third supply call. No GPA, pagination, retry, fallback or extra discovery. Maximum2 wire attempts; existing30-second/1MiB per-response caps and finite diagnostics remain unchanged.

Discovery amounts must be canonical unsigned decimal u64 strings and decimals must be literal integer9. Duplicate addresses, the mint substituted as an account, malformed identifiers/amounts/context, and oversized selections stop before request2. Later accounts still require reviewed canonical Token-2022 ownership, nonexecutable state, fixed mint, strict base/ImmutableOwner layout and option validation. Mint must match the reviewed base82 configuration. Unsupported extensions remain a stop, not a safety inference.

## Evidence meaning
LP_TOP20_AUTHORITY_V1 preserves discoverySlot, discoverySelection (address, raw amount, decimals and providerReturnedPosition), separate observationSlot and later typed account values. Positions are explicitly provider-returned order, NOT certified rank. Increasing amounts are not promoted to a trusted ordering claim. discoveryRankVerified and crossSlotRankVerified are false.

When both context slots are equal, every discovery amount must equal that account's decoded batch amount or the run fails closed. Advancing-slot differences are retained separately, never overwritten or interpreted as unexplained transfers. No cross-slot rank or membership claim.

observedBalanceSumRaw and mintSupplyRaw are exact decimal integers from the same second batch. observedSupplyFraction contains numeratorRaw/denominatorRaw without floating-point conversion. Zero mint supply gives null fraction and undefined_zero_supply; positive observed sum above supply is rejected. Equality does not prove full membership, unseen zero-balance accounts, custody or redemption. Completeness, custody, redemption, historical ownership and score flags remain false.

Typed output retains only reviewed account/program/mint, owner, active delegate/delegated amount, active close authority, state, supported extension IDs and byte hashes/lengths. Raw bytes, inactive-option garbage, URLs and arbitrary provider/error strings are excluded. Both source digests/lengths and original provenance limitations remain. No user identity attribution. Reviewed raw/decoded/output leakage gates remain; no universal covert-channel assurance.

## Disclosure, workflow and cost boundary
No new execution is authorized. Any future owner approval must cover this changed selection method, at most2 requests, maximum additional USD0.01 after entitlement confirmation, and repository-readable typed account/authority/balance evidence retained1day; downloaded copies can persist. No private retention is established. Nominal40CU at published USD0.525/M is USD0.000021, not account-specific billing proof.

Existing manual workflow and inactive workflow proposal are unchanged and call the same script path; exact reviewed-SHA/default-false disclosure/attempt1 guards and one-day allowlisted output remain. This does not authorize dispatch or make separate attempt1 runs impossible. No live API route is used. Original GPA proposal history remains in Git; it is superseded for this candidate by this document, not reinterpreted as top20 approval.

## Offline validation
Original top20 revision:34 passing collector tests, including updated transport fixtures; this is not a claim of only4 new tests. Narrow correction: python mvp/wallet-signal/tests/lp-inventory.test.py -k same_slot —2 passed. These cover equal-slot mismatch rejection, advancing-slot differences, equal-slot matching balances, and increasing discovery amounts labeled provider-order-only. No full suite rerun after this correction. No RPC or hosted acceptance claimed.

Primary selection contract: https://solana.com/docs/rpc/http/gettokenlargestaccounts . Provider success remains unverified. A top20 selection is useful for bounded custody candidates, not full LP inventory or withdrawal safety.
