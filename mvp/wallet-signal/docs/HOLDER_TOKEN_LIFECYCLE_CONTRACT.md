# Narrow Holder token ancillary-instruction contract

This change recognizes only GetAccountDataSize and InitializeImmutableOwner.
It neither establishes historical owners nor decodes a complete transaction.

## Pinned official sources

- Agave parser, commit c1080de464cfb578c301e975f498964b5d5313db (v2.1.0):
  https://github.com/anza-xyz/agave/blob/c1080de464cfb578c301e975f498964b5d5313db/transaction-status/src/parse_token.rs
  The parser emits getAccountDataSize with mint and optional extensionTypes;
  initializeImmutableOwner carries account. Both inspect the first account.
- Token-2022 layout/extension definitions, commit 875693f53c77534b46f0d06bdf781430870f8177:
  https://github.com/solana-program/token-2022/blob/875693f53c77534b46f0d06bdf781430870f8177/interface/src/instruction.rs
  https://github.com/solana-program/token-2022/blob/875693f53c77534b46f0d06bdf781430870f8177/interface/src/extension/mod.rs
  Opcode 21 is followed by u16 little-endian extension IDs; ImmutableOwner is ID 7.
  Opcode 22 encodes InitializeImmutableOwner.
- Token-2022 execution:
  https://github.com/solana-program/token-2022/blob/875693f53c77534b46f0d06bdf781430870f8177/program/src/processor.rs
  Size calculation reads mint data and sets return data. Immutable-owner initialization
  modifies the single uninitialized token account, not unrelated accounts.
- Legacy SPL Token execution, commit 3d53b934b90d5b5d5716553fbcbf63aa20a07c70:
  https://github.com/solana-program/token/blob/3d53b934b90d5b5d5716553fbcbf63aa20a07c70/program/src/processor.rs
  Size calculation returns Account::LEN. Immutable-owner initialization checks an
  uninitialized account but does not install Token-2022 immutable-owner protection.

These pinned source contracts are not attestation of the historical deployed binary.

## Deliberately narrower admission

Only canonical SPL Token/Token-2022 program IDs qualify. Parsed info fields must match
the exact supported shape, with a 32-byte base58 key present in the transaction.
Size extensions are limited to omitted/empty or exactly ['immutableOwner']; other
variants stay Unknown. No blanket extension-name allowlist is inferred.

Partially decoded instructions with programId and address-valued accounts may carry
base58 data: exact 15, 150700 or 16 hex only, exactly one account. If both parsed and
raw representations exist, they must agree. Extra/truncated bytes, contradictory
fields, extra/missing accounts and unsupported extensions remain globally opaque.
This is stricter than upstream minimum-account parsing. Full compiled programIdIndex
RPC envelopes still require a separate adapter; no such adapter is added here.

A valid size query is ownership-neutral. Immutable-owner initialization ALWAYS marks
its account conflicted, including the legacy compatibility no-op. Existing create,
close, setAuthority and initialization conflicts are unchanged. No owner is created
from these instructions. Unknown token variants remain transaction-wide uncertainty.

## Retained witness and tests

Run 44272054942's authentic projection contains legacy SPL Token inner 2:0 data 84eT
(hex 150700), account index 27; inner 2:2 data P (hex 16), account index 2.
The new focused tests consume those bytes but label provider-shaped inputs synthetic.
They demonstrate scoped conflict on temporary index 2 and retain all original
projection flags. The complete partially reconstructed witness still has opaque
instructions and is NOT automatically promoted.

Tests cover both canonical programs, exact raw/parsed representations, malformed
data/accounts/extension lists, foreign programs, and unchanged lifecycle conflicts.
No chain calls, current-owner lookup, scoring, acceptance promotion, schedule,
collector dispatch or historical checkpoint changes.
