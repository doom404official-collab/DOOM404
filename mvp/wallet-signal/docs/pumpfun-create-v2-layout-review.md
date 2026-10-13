# Pump.fun create_v2 independent layout review

Reference: https://github.com/pump-fun/pump-public-docs/blob/main/docs/instructions/COIN_CREATION.md
Reference IDL: https://github.com/pump-fun/pump-public-docs/blob/main/idl/pump.json

Observed transaction: KMoj9pQq8XncaZPHQ5bTNZPDgQwfCBgdihVkxc5Y27fh7iGYwMbti2Mcscprhia1NBJauBbEvs5DE8ooWKWg6bs
Mint: 98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump

## Comparison
- Pump program ID matches documented address.
- 19 accounts observed, consistent with 16 IDL accounts + 3 quote remaining accounts.
- Index 0 mint; index 5 user (signer/payer); index 6 system; index 7 Token-2022; index 8 associated token; index 15 Pump program.
- Index 16 wrapped SOL quote mint, index 17 associated quote bonding curve, index 18 legacy token program.
- Creator is an instruction data pubkey following name, symbol and URI, NOT necessarily account index 5.
- Observed user and creator happen to be equal; do not assume equality for other launches.
- Wrong mint rejected by existing decoder.
- Current decoder does not fully support optional creator_fee_bps (OptionU64) and holder-reward argument combinations. Do not certify all create_v2 variants until fixed and tested.
- Existing fixture uses observed account addresses with synthetic instruction bytes. It is NOT a raw historical byte fixture.

## Release gate
Status: PARTIAL_LAYOUT_CORROBORATION. The observed fixed account prefix matches the official specification, but complete argument parsing, full raw-byte reproduction, negative cases and unrelated-token tests remain pending. Do not promote to production VERIFIED on this evidence alone.
