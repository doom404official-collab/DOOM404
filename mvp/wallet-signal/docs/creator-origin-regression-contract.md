# Creator Origin Resolver — implementation and regression contract

Status: development specification; not production verified.

## Output
Return `mint`, `status` (VERIFIED | PARTIAL | UNRESOLVED), `launchpad`, `roles`, `evidence`, and `warnings`.
Each role includes `address`, `role`, `sourceSignature`, `programId`, and `verificationMethod`. Never substitute fee payer, mint authority, or metadata update authority for launchpad creator.

## Resolution sequence
1. Validate the mint and identify its token program.
2. Discover historical creation signatures using an archive-capable index; do not assume a limited RPC page reaches genesis.
3. Fetch and verify candidate transactions and inner instructions against the requested mint.
4. Decode known launchpad creation instructions using versioned, program-ID-specific decoders. Unsupported layouts remain UNRESOLVED.
5. Independently extract mint initialization, account funding, fee payer, signer, and metadata roles.
6. Return VERIFIED only for roles directly supported by verified instruction evidence. Preserve provenance and conflicting candidates.
7. Cache immutable evidence by mint and signature, including decoder version; avoid treating a cache hit as proof without provenance.

## Regression cases
- Launchpad creation with separate fee payer and creator.
- Direct SPL Token mint with no identifiable beneficial owner.
- Token-2022 metadata update authority differs from initialization signer.
- Failed transaction must not count as creation.
- Inner instruction creation, versioned transactions, and address lookup tables.
- Multiple candidates or unavailable archival history -> UNRESOLVED with reason.
- RPC timeouts, rate limits, pagination exhaustion, and malformed provider responses.
- Cached evidence is tied to signature and decoder version.
- Never infer beneficial ownership or connect unrelated wallets from fee payer alone.

## Release gate
Run deterministic fixture tests with transaction signatures and expected roles, then integration tests against archival data. Verify Super Inu using its exact mint address and original transaction before reporting attribution. No merge/deploy until explicit approval.
