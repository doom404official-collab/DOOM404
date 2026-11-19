# Creator Intelligence: Pump.fun live-validation gate

This feature is NOT verified creator extraction yet. Do not infer the launch creator from the first signer, fee payer, mint authority, or an arbitrary account index.

## Required independent evidence
1. A successful mainnet creation transaction with signature, block time and mint.
2. Pump.fun program ID matched against a trusted source.
3. Creation instruction discriminator and account schema verified against the matching deployed program version/IDL.
4. Exact mint and creator account positions decoded from that instruction; validate that the instruction references the requested mint.
5. Cross-check against at least one independent explorer or indexer, recording disagreements rather than hiding them.
6. Store fixture transaction signatures and expected addresses, with redacted RPC credentials; cover both older and newer supported launch versions.

## Outcome states
- program_interaction_observed: Pump.fun instruction and mint reference only; creator unknown.
- launch_instruction_verified: known creation instruction decoded and mint matched.
- launch_creator_observed: creator account extracted from verified instruction; this proves only the on-chain launch role, not real-world identity or beneficial ownership.
- unverified: unknown layout, unsupported program version, absent historical transaction, or inconsistent evidence.

## Test before release
Use known creation signatures for classic Pump.fun and any newer supported versions; also test trading-only transactions, unrelated mints, failed transactions, CPI, and unsupported launchpads. Require CI pass and live Preview validation before claiming creator extraction.
