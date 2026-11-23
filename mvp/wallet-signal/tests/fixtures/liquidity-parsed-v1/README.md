# Synthetic parsed-v1 shape fixture

transaction.json is hand-built synthetic input, not a provider receipt or signed
transaction. Keys derive from repeated test bytes; the all-zero signature is not
cryptographic proof. PumpSwap's program identifier and Anchor discriminator only
exercise existing candidate extraction; instruction arguments and authority are
not certified. Outer index 0 and inner index 0 must remain separate candidates.

Pinned references inspected without contacting a chain:
- https://github.com/anza-xyz/agave/blob/c31ad74dc068e59acf7d5b5a14835ef9a52ec35b/transaction-status/src/lib.rs#L636
- Same file lines 844–865: v1 parsed message, inline keys, no ALTs, transactionConfig.
- https://github.com/anza-xyz/agave/blob/c31ad74dc068e59acf7d5b5a14835ef9a52ec35b/transaction-status-client-types/src/lib.rs#L239
- https://github.com/anza-xyz/agave/blob/c31ad74dc068e59acf7d5b5a14835ef9a52ec35b/transaction-status/src/parse_accounts.rs
- https://github.com/solana-foundation/upgrades-examples/blob/47e716616ac62173ab71f15d9ade7edc02ab0d7a/transaction-v1/README.md
- https://solana.com/docs/rpc/json-structures (reference, not an immutable pin).

RPC JSON uses priorityFee, not the examples' SDK config setter name
priorityFeeLamports. All four RPC config properties must exist and may be null.
Unsafe JSON integers are rejected; this intentionally supports only exact safe
priorityFee values, rather than rounding a full u64. No fee calculation is added.
Parsed v1 only is admitted: compiled/raw v1, lookup keys, ambiguous versions and
incomplete CPI remain unresolved. Legacy/v0 behavior and checkpoint receipts are
unchanged. Shape tests do not establish provider interoperability, historical
program semantics, archive completeness, signer control or authorization.

Additional pinned shape constraints:
- Agave at the same commit, transaction-status/src/parse_instruction.rs lines
  24–54 and lib.rs lines 89–117: PumpSwap is not a fully parsed program; its
  instructions must retain partially decoded accounts and base58 data.
- transaction-context/src/transaction.rs lines 333–337, 513–568 and 581–605:
  invocation pushes one stack frame; returns pop frames. A complete CPI group
  starts at height 2; increases cannot skip a frame. Siblings and multi-frame
  returns are allowed. transaction-status/src/lib.rs lines 119–155 preserves
  recorded order/heights and omits empty groups.
These checks cannot detect an entirely omitted CPI group or distinguish a genuine
empty trace from provider omission. Shape admission and empty-page exhaustion do
not certify archival/CPI completeness or transaction-time authorization.

Memo compatibility is limited to the three IDs in spl-memo-interface 2.1.0
(Agave pinned Cargo.lock checksum
3745d384b0afee980d43d62b66c27bdcbbd03507732b8d3626d3413cb72084f2):
https://docs.rs/spl-memo-interface/2.1.0/src/spl_memo_interface/lib.rs.html
The pinned parse_instruction.rs maps these IDs to SplMemo, emits the spl-memo
label and parses UTF-8 data as a JSON string (including empty strings).
Only that exact ID/label/string combination is admitted; this does not relax
PumpSwap's partially decoded instruction requirement.
