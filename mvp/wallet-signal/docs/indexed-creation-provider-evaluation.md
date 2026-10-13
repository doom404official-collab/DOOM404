# DOOM404 — Indexed Pump.fun creation-event provider evaluation

Date: 2026-10-13
Status: Research and evaluation only. No production integration.

## Existing verified components
- Pump.fun coin metadata provides an indexed creator wallet and creation timestamp.
- Helius RPC retrieves original Solana transactions for instruction verification.
- Historical creation signature is confirmed for one test mint; other tokens remain indexed-unverified.

## Candidate 1: Bitquery
Official documentation: https://github.com/bitquery/Pump-Fun-API
GraphQL examples include Solana.Instructions queries filtered by mint in Instruction.Accounts, Pump program, and creation method, returning Transaction.Signature.
Documentation for launch streams covers both create and create_v2. Confirm exact query schema and historical availability in the user's account before enabling.

Evaluation query sketch (adapt and validate in Bitquery IDE, not production):
query {
  Solana {
    Instructions(
      where: {
        Instruction: {
          Accounts: { includes: { Address: { is: "REPLACE_WITH_MINT" } } }
          Program: { Address: { is: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P" }
                     Method: { in: ["create", "create_v2"] } }
        }
      }
    ) {
      Transaction { Signature }
      Instruction { Program { Method } Accounts { Address } }
      Block { Time }
    }
  }
}

## Candidate 2: Birdeye
Documentation: https://birdeye.so/data-api/blog/detail/solana-trading-bot-api-data-layer-birdeye
GET https://public-api.birdeye.so/defi/token_creation_info?address=MINT
Requires X-API-KEY and x-chain: solana.
Check account entitlement and response schema before integration. Its 'deployer' may not equal launchpad-designated creator.

## Decision gates
1. Test five existing unrelated mints with the provider's documented historical query.
2. Record exact creation signature, indexed wallet label and creation instruction method.
3. Independently fetch each signature through Helius.
4. Decode mint and creator argument; distinguish fee payer, signer, user and creator.
5. Mark VERIFIED only after matching on-chain evidence. Otherwise INDEXED_UNVERIFIED.
6. Do not purchase a subscription or expose API keys without approval.

## Current decision
Bitquery first for historical creation events; Birdeye secondary.
Retain Pump.fun metadata for fast creator candidate lookup and Helius for on-chain verification.
Do not resume expensive unbounded mint/wallet scanning.
