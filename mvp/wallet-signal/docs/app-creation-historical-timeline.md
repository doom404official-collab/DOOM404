# APP creator attribution — historical documentation timeline

Date: 2026-10-13
Status: historical compatibility research; no decoder promotion.

## New source evidence
Pump.fun public docs commit 8cda1fa30ea658b20909d8aedf002047119388d2 dated 2026-10-08 adds documentation for creating coins quoted in other Pump coins:
https://github.com/pump-fun/pump-public-docs/commit/8cda1fa30ea658b20909d8aedf002047119388d2

The earlier docs at f216b6724c6ede79d7cef9ce210b741f7e17e93b described only the 16-account base create_v2 and three optional remaining quote accounts:
https://github.com/pump-fun/pump-public-docs/blob/f216b6724c6ede79d7cef9ce210b741f7e17e93b/docs/instructions/COIN_CREATION.md

The newer pump-coin-quote documentation requires quote_control plus quote_bonding_curve; APP's observed instruction contains quote_control but not quote_bonding_curve:
https://github.com/pump-fun/pump-public-docs/blob/main/docs/instructions/CREATE_WITH_PUMP_COIN_QUOTE.md

## Interpretation
A documentation commit date is NOT a protocol deployment date. Historical layout support must be grounded in the transaction slot and program implementation/IDL at that slot.

## APP observations
- Known signature: aLBaPgDsc5x6FgpirNJnmgFEjfz2DveHQ3xaKYeypdZq26WiYt7wjoVfNqgWMfiKR6DYveZmGiYAnN6Y593SXZ7
- Decoded creator matches Pump.fun indexed creator.
- create_v2 instruction has 20 accounts and a complete decoded argument payload.
- Quote ATA derivation matches; quote_control matches official PDA.
- quote_bonding_curve PDA is not present in transaction.
- Formal status remains INDEXED_UNVERIFIED until strict historical verification.

## Next targeted evidence
1. Obtain slot/blockTime of the known transaction.
2. Find archived program IDL, deployment history or release notes around that slot.
3. Identify 20-account successful creation examples from same time range.
4. Add strict versioned decoder only after evidence; test wrong mint/creator/quote account.
5. Never infer a real-world human identity from a wallet.
