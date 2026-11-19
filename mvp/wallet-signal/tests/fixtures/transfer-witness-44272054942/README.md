# Retained authentic transaction projection — local review candidate

Public blockchain projection from approved fixed lookup:
- Repository: doom404official-collab/DOOM404
- Actions run: 44272054942, attempt 1; collector commit 35a7fc784ea386c90bcd59bc6ab10cd21326db80
- Artifact: 14411644673; original artifact expiry 2026-11-19T09:01:37Z
- Source: finalized getTransaction, JSON, maxSupportedTransactionVersion 0
- Exact projection: 7719 bytes, SHA256 6e54ec856837729bffeb25ac1acb1a346eaec044d830b534bee71cd674328942
- Original response: 13896 bytes, receipt SHA256 8118e716747d5bce90262370b4b8c26e691aad76b03104ee89180c4c4c7c6934; original bytes NOT retained
- Parent supplied exact downloaded projection text; independently recreated without trailing newline and hash-checked. This fixture is the projection, NOT full raw RPC JSON.
- No provider endpoint, app identifier, credential, arbitrary log text or raw error body included.

Reproduce: node --test tests/authentic-transfer-witness.test.mjs

The dependency-free Node test independently serializes the legacy message and verifies
Ed25519 using node:crypto. Message SHA256:
a96d6d71dc6406f3cf7b500553dcda04bf4957d722025c3db471fdd6b6e9546d.
A mutated message is rejected. Signature verification covers signed outer instructions,
not provider-reported slot/finality, inner execution, error status or balances.

The target transfer is outer 6 / inner 1, 22632179539 raw at six decimals.
Both target-account deltas equal that amount, and all four persistent wrapped-SOL
recipient changes match the decoded transfers. Their total is 2000000000 raw.
These are one historical witness's internally reconciled RPC metadata, not universal
fee behavior, historical mint configuration or fee-recipient authorization.

## Parser compatibility versus authentic evidence

Tests reconstruct a provider-shaped object locally from the projection. This is
explicitly a SCHEMA RECONSTRUCTION; it is not a recovered authentic jsonParsed response.
TransferChecked is decoded from retained bytes. Other instructions remain opaque,
and transfer-time ownership guards correctly withhold Holder edges.

A separate, explicitly synthetic isolated-instruction case verifies that
holderNetworkTransfers accepts a generic spl-token parsed label with the canonical
Token-2022 program ID. It must not be used as historical settlement evidence.
Creator observation extraction accepts the reconstructed target as
UNVERIFIED_SPL_TRANSFER, independentlyVerified false.

No production parser changes are needed for generic-label compatibility.
Do not bypass opaque lifecycle instructions or reinterpret missing temporary-account
balances as zero. Missing/conflicting owners and setAuthority remain negative cases.

## Remaining acceptance boundary

This supports a scoped TS08 single-witness observation; it does not close TS08 or TS09,
select TS07 methodology, authenticate execution metadata cryptographically, or supply
missing Holder/Liquidity/Creator completeness for Overall.

For automatic Holder ingestion of this witness, the still-missing input is complete
supported parsed lifecycle semantics (or a separately reviewed exact compiled decoder)
and transfer-time ownership proof. A new provider call is not required merely to test
a decoder: retained compiled bytes are available. No decoder expansion is included
in this compatibility review. Any later decoder work must preserve Unknown for
unrecognized variants and must not infer fee-recipient authorization.

For broader authentic behavior acceptance, a precise scenario/coverage criterion
must first be established; no arbitrary second transaction or history scan is proposed.
Original projection flags stay false. No gate, calibration, score or three-insight
ranking is promoted by these checks.
