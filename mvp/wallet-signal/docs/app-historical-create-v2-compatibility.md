# APP historical Pump.fun create_v2 compatibility review

Status: RESEARCH — no decoder change, no deployment to production.

## Evidence
- Mint: 6MnQ921sqsShymdoqPv2RfhL5g2Hk2hoqPvgpDGcpump
- Creation candidate: aLBaPgDsc5x6FgpirNJnmgFEjfz2DveHQ3xaKYeypdZq26WiYt7wjoVfNqgWMfiKR6DYveZmGiYAnN6Y593SXZ7
- Indexed creator and decoded instruction creator agree: 2MgzLLRwSqBfMABf3peoPeQJsJHL1yxWw2p1Wf5yapER
- create_v2 discriminator, mint binding, full arguments and quote ATA derivation match.
- 20 accounts: 16 fixed + quote mint + quote ATA + quote token program + quote_control.
- Quote_control address matches official Pump PDA.
- Expected quote_bonding_curve is absent from instruction and transaction.
- Current docs require 5 remaining accounts for pump-coin-quoted launches, 8 if migrated.

## Sources
- https://github.com/pump-fun/pump-public-docs/blob/main/docs/instructions/COIN_CREATION.md
- https://github.com/pump-fun/pump-public-docs/blob/main/docs/instructions/CREATE_WITH_PUMP_COIN_QUOTE.md
- https://github.com/pump-fun/pump-public-docs/blob/main/idl/pump.json

## Critical distinction
Matching on-chain creator data is meaningful, but this 20-account instruction is not yet supported by our strict decoder. Never mark it VERIFIED based on matching a single indexed source.

## Next targeted research
1. Inspect git history of official pump documentation and IDL at or before APP creation block.
2. Establish whether the quote mint was a whitelisted/custom quote at that block.
3. Confirm transaction slot and program deployment history.
4. If a historical layout is proven, add versioned decoder that validates all 20 account roles and instruction bytes.
5. Regression test positive APP transaction and negative wrong-mint, wrong-creator, malformed extra-account cases.
6. Preserve the status INDEXED_UNVERIFIED until a strict decoder validates it.

## Avoid
- No unbounded transaction scans.
- No guessed account roles.
- No additional paid data provider.
- No promotion of creator confidence solely from the count of matching sources.
