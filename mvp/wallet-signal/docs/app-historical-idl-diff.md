# APP 20-account create_v2: historical IDL comparison

Date: 2026-10-13
Reference slot: 453364536 (2026-10-04T20:31:18Z)
Reference signature: aLBaPgDsc5x6FgpirNJnmgFEjfz2DveHQ3xaKYeypdZq26WiYt7wjoVfNqgWMfiKR6DYveZmGiYAnN6Y593SXZ7

## Confirmed source comparison
Pump.fun older IDL (commit f216b6724c6ede79d7cef9ce210b741f7e17e93b):
https://github.com/pump-fun/pump-public-docs/blob/f216b6724c6ede79d7cef9ce210b741f7e17e93b/idl/pump.json

- Contains error 6075 InvalidQuoteControl.
- Does not list error 6099 InvalidQuoteBondingCurve.

Pump.fun current IDL:
https://github.com/pump-fun/pump-public-docs/blob/main/idl/pump.json

- Contains error 6075 InvalidQuoteControl.
- Contains error 6099 InvalidQuoteBondingCurve.
- Current Pump-coin-quoted create_v2 docs require five remaining accounts for a bonding-curve quote.

## Interpretation
The earlier IDL is consistent with an older quote-control layout that may not have required quote_bonding_curve, but error definitions alone do not establish accepted instruction account layouts or program deployment slot.

## Validation gate
Before accepting APP's 20-account create_v2:
1. Establish historical on-chain program deployment or official source/IDL that documents four remaining accounts.
2. Validate discriminator, mint, creator arguments, quote ATA derivation and quote_control PDA.
3. Ensure the transaction succeeded and the historical program format supports exactly this remaining-account layout.
4. Add regression cases rejecting wrong mint, wrong quote-control, wrong quote ATA and malformed data.
5. Keep status INDEXED_UNVERIFIED until the historical layout is independently substantiated.

## October 7 preserved SDK source: four-account quote-control branch

A third-party preserved SDK source snapshot includes `createV2QuoteRemainingAccounts`:
https://github.com/mthwtsng/crypto-research/blob/acc4104d67c96f60f49ea15cbfb629557383c5b7/research/wallet_curve_entry_discovery_20261007/official/package_src_sdk.ts

The builder appends four accounts for a non-legacy quote mint:
1. quoteMint
2. quote ATA derived from the new mint bonding curve
3. quoteTokenProgram
4. QUOTE_CONTROL_PDA

It appends the fifth quote bonding curve only when `pumpQuote` is provided. The accompanying comment says the program ignores the fourth account for Global-whitelisted mints and requires it for a quote-control-admitted mint. Thus APP's 20 accounts may be a valid quote-control-listed mint variant, NOT an incomplete pump-coin quote.

This is stronger than the earlier IDL error-code inference but is not independently verified on-chain program source at APP's slot. Before promotion, require exact 20-account match, quote-control PDA, quote ATA derivation, supported quote-mint admission at launch, complete instruction arguments, and negative tests. No blind count expansion.
