# Creator attribution correction review — 14 October 2026

**Status:** Prepared for review. NO database write authorized or executed.

## Subject
Mint: `98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump`

Transaction: `KMoj9pQq8XncaZPHQ5bTNZPDgQwfCBgdihVkxc5Y27fh7iGYwMbti2Mcscprhia1NBJauBbEvs5DE8ooWKWg6bs`

Pump.fun program: `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`

Decoder version: `pump-fun-create_v2-prefix-v1`

## Discrepancy
- Indexed candidate: `6RKsroTt2NgJvyUyhUcKqANrphWDw6eE52X9TMBsQ7WC`
- Decoded launchpad creator: `6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC`
- First differing character: zero-based index 25; indexed `h`, decoded `H`.
- Addresses are different Base58 public keys. Do not silently overwrite either value.

## Evidence
- GitHub manual diagnostic: oldest-first indexed history returned the creation signature and the Pump.fun decoder extracted the launchpad creator.
- Exact-transaction corroboration reproduced the decoded creator.
- Secondary parser returned `DECODERS_AGREE` and `indexedMatch:false`.
- Both implementations read the same RPC transaction. No independent provider or human review is claimed.

## Required before any mutation
1. Confirm transaction success, mint binding, program ID, discriminator, instruction argument offsets, account layout and decoded creator using independent review.
2. Read the current attribution and evidence rows; verify their existing status and capture an audit record. Do not assume a missing or unverified row.
3. Establish why the indexed candidate differs (transcription or provider attribution); preserve the original value and source.
4. Review the Supabase RPC `store_creator_evidence` contract and schema to ensure a conflicting indexed candidate cannot be silently promoted or overwritten. Require an explicit conflict-resolution operation with expected-current-state checks and audit logging.
5. Present a proposed exact mutation and rollback plan for separate user approval. Do not mark `VERIFIED`; any on-chain match awaiting independent review must retain `ONCHAIN_MATCH_PENDING_INDEPENDENT_REVIEW`.
6. After approved persistence, read back both attribution and transaction evidence and verify API output.

## Non-goals
No creator trading-history claim, beneficial-ownership claim, financial safety score, production deployment, branch merge, or automatic writes during a customer scan.
