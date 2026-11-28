# CLMM indexed pool identity correction

The finalized live pool `35aFe6FhR7CnbLJE5ma8c93YJ2pkrURCTYv2GvVTAack`, slot 474917110, uses the Raydium customizable-v2 indexed pool PDA. Its seed index is 1. A legacy-only PDA calculation incorrectly rejected this pool as unverified infrastructure. The liquidity identity helper previously accepted layout/mint binding without validating its pool PDA.

Official source pinned at commit `6d7a0f82d2f293c553c69aaf943377367c6c4cc6`:
https://github.com/raydium-io/raydium-clmm/blob/6d7a0f82d2f293c553c69aaf943377367c6c4cc6/programs/amm/src/states/pool.rs

Downloaded source SHA256: `f9f8927810502ba5aed4a31ad088e368246d3957398608b24a1f8a3c9ef4ba3f`.

`PoolState` is packed. Its account discriminator occupies bytes 0–7, bump 8, config 9–40, mint A 73–104, mint B 105–136, vault A 137–168, vault B 169–200, status 389, fee_on 390 and seed_index 391–392. The index is little endian; zero selects legacy seeds. Nonzero adds the two index bytes after config/mint A/mint B. The stored bump must equal the canonical PDA bump. Each declared vault must separately derive from `pool_vault`, pool address and its mint.

Pinned SDK `@raydium-io/raydium-sdk-v2@0.2.87-alpha` has the same 1544-byte layout. It currently exposes index bytes as padding, but its `getPdaCustomizablePoolV2Id` supports the indexed derivation. For the actual retained account, index 1 derives the exact pool address and bump 255. Both declared vault PDAs match. Legacy `getPdaPoolId` produces a different address as expected.

The shared pure identity verifier now supports both branches and rejects altered index, config, bump or vault. Tests retain the actual finalized compressed account bytes; they do not generate substitute live evidence. Updated synthetic legacy fixtures use sorted mints and canonical pool/vault/bump values.

Validation: 36 focused tests passed across clmm-v2-identity, universal-protocol-identities, wp03-allocation-controls and protocol-closure-v1. Syntax checks and git diff whitespace checks passed.

Scope remains identity and declared reserve-account role only. Executable concentrated-liquidity depth, current vault token controls, fee-inclusive quotes, LP position custody, administrative powers and withdrawal rights are separate evidence. No safety or withdrawal-control coverage is created by this correction.
