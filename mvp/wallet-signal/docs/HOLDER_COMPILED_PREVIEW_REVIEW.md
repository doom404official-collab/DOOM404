# Offline compiled instruction preview — reproducible tooling

Base: 0939b1fc998e8506427c518ca135e665ec846bc2.
No production imports, worker wiring, execution/ownership verification, persistence,
RPC calls or acceptance promotion. This previews schema normalization only.

## Exact remaining gap

The json getTransaction projection retains programIdIndex/account indexes/base58 data.
The production Holder extractor expects programId plus parsed instructions; raw compiled
envelopes are rejected before the ownership timeline. The earlier partially reconstructed
schema decoded TransferChecked but left System/Token lifecycle instructions opaque.
That is a format coverage gap, not evidence of incorrect historical ownership.

## Retained witness inventory

| Location | Program | Exact operation/layout | Existing timeline semantics |
| --- | --- | --- | --- |
| outer 4, 8, 9 | System | u32 LE tag 2 + u64 lamports; 12 bytes, 2 accounts | Ownership-neutral transfers |
| inner 2:1 | System | u32 tag 0 + u64 lamports + u64 space + 32-byte owner; 52 bytes, 2 accounts | createAccount conflict on index 2 |
| outer 5 | legacy Token | opcode 17; 1 byte, 1 account | syncNative, ownership-neutral |
| outer 7 | legacy Token | opcode 9; 1 byte, 3 accounts | closeAccount conflict on index 2 |
| inner 2:3 | legacy Token | opcode 18 + 32-byte owner; 33 bytes, 2 accounts | initializeAccount3 conflict on index 2 |
| inner 2:0 | legacy Token | 150700 hex; 1 account | Validated size query (existing 0939b1 handling) |
| inner 2:2 | legacy Token | 16 hex; 1 account | Immutable-owner initialization conflict on index 2 |
| inner 6:1 | Token-2022 | opcode 12 + u64 amount + u8 decimals; 10 bytes, 4 accounts | TransferChecked candidate, no owner inference |
| inner 6:2–5 | legacy Token | same exact TransferChecked layout | Transfer candidates, temporary source owner unresolved |

There are 21 instructions total; 14 have supported exact layouts. Seven remain
unsupported and retained: outer 0/1 (Compute Budget), outer 2/3 (Associated Token),
outer 6 (AMM), inner 6:0 (fee program), inner 6:6 (AMM). No role/fee authorization,
AMM semantics or successful execution is inferred from decoding them.

## Pinned official contracts

Existing ancillary sources remain in HOLDER_TOKEN_LIFECYCLE_CONTRACT.md.
Additional mapping sources:
- https://github.com/anza-xyz/agave/blob/c1080de464cfb578c301e975f498964b5d5313db/sdk/program/src/system_instruction.rs
- https://github.com/anza-xyz/agave/blob/c1080de464cfb578c301e975f498964b5d5313db/transaction-status/src/parse_system.rs
- https://github.com/anza-xyz/agave/blob/c1080de464cfb578c301e975f498964b5d5313db/transaction-status/src/parse_token.rs
- https://github.com/solana-program/token-2022/blob/875693f53c77534b46f0d06bdf781430870f8177/interface/src/instruction.rs

System CreateAccount derives funding/new-account keys from indexes and owner from
payload bytes; raw lamports/space remain decimal strings. Token InitializeAccount3
also derives owner from its payload. No current-account lookup or guessed fields.
TransferChecked and CloseAccount support single-authority account counts only;
multisig and any extra account or trailing bytes remain unsupported.

## Scope and assurance limits

scripts/offline/preview-holder-compiled-instruction.mjs returns labeled DERIVED_CANDIDATE
or UNKNOWN, executionVerified false. Inputs are bounded to 256 canonical unique keys,
four accounts and 72 base58 data characters. Both key and account-index arrays must
be dense with an own property at every index; inherited values cannot fill holes. It rejects mixed parsed/compiled inputs,
unsafe/out-of-range indexes, malformed keys, and unknown layouts. It neither validates
a whole transaction nor establishes signature authority/CPI privileges or metadata
authenticity. Unknown instructions are never rewritten as safe parsed operations.

Tests explicitly build a synthetic schema from retained bytes. All seven unsupported
instructions remain in the timeline. Existing context reports conflict only on index 2,
with stable pre/post owner observations for indices 7/9; this is not a new verified
owner assertion. Existing context ignores non-System/non-Token program instructions;
its complete-inner-instruction/provider-trust assumptions are unchanged, not proved
by this preview. No production extractor/promotion or checkpoint save is invoked.

Validation: node --test tests/holder-compiled-preview.test.mjs — 5/5 passed.
No build or aggregate rerun: runtime code is unchanged. Published scope is offline tooling and its tests only; runtime integration is not
authorized by this document. Original projection and its false verification flags unchanged.
