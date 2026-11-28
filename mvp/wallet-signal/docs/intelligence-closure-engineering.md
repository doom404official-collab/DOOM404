# V1 intelligence closure — partial protected candidate

Baseline: 123fe956246a13d3515478d8cda9d1f49d3f7c9f, following requested 400cc3e18a4d5d86f30d2ecc5c68adceb5d453d3. The current Library handover and branch agree on the later baseline. Production promotion is not authorized.

## Root causes corrected

- Creator instruction search ignored nested Pump.fun instructions. Existing strict discriminator/layout, mint birth and signer checks now apply to nested candidates too; unknown launch mechanisms remain unsupported.
- The bounded origin loop retained its first proof after a conflicting proof threw. It now clears attribution and exposes `conflicting_evidence` instead of a generic provider error. Invalid indexed pages also fail closed.
- Recent creator history shared eight candidate slots with holder work. Creator candidates now take precedence. One material holder relationship does not terminate unresolved creator questions. No quota increase.
- Targeted early history fell back to the creator wallet when no creator allocation appeared in the creation post-balances. It now targets the current nonzero token account when available. Closed accounts and complete history remain unestablished.
- Receipt classification supported only one narrow classic SPL path. A second strict verifier supports exact direct Token/Token-2022 receipts and mint receipts, with signer and balance reconciliation. Unsupported CPI/swaps, fee shortfalls and ownership ambiguity are rejected. Direct mint receipts are a separate event type; neither purchases nor initial allocations are inferred.
- The holder endpoint silently discarded off-curve/program allocations. A shared allocation classifier retains all valid observed allocations, including restricted and unclassified accounts. Recognized Pump bonding-curve PDAs identify a role only; withdrawal rights remain separate. No exchange/treasury/vesting labels are guessed.
- Score selection used null-coalescing rather than the chart's validated quote metric. Both now use canonicalQuote. Detailed quote basis follows the same projection. A protocol selling-disabled state no longer emits an insufficient-reserves claim.

## Scope and numerical policy

The homepage, tab structure, overall weights, scoring thresholds, production controls, provider quotas and schema are unchanged. New incoming/direct-mint event categories appear in existing creator evidence. Material unknown allocation findings use explicit uncertainty and grey presentation. Their observed supply share is preserved outside the eligible-wallet subtotal. This can change a current sample's eligible concentration; it does not change concentration severity thresholds or weightages.

No new coverage credit is earned by finishing an investigation. Partial unknown allocations, unsupported launch decoding, unverified release conditions and missing execution routes remain limitations. Current cached observations can live for the existing one-hour TTL; revision 4 is not claimed to have run merely because new source is deployed. No schema or cache lease bypass was introduced.

## Validation integrity

The live matrix contains fifteen distinct fixture-resolved mints. It replays current mint controls and ten discovered token accounts, with separately observed owner metadata. It is NOT fifteen complete hosted scanner passes. Category requirements for currently active curves, recently migrated pools, live Orca and low-liquidity routes are not independently qualified by this subset. Overall risk is withheld; missing creator/liquidity scores remain null. Connector timings are not scan latency. Full hosted initial-report and investigation median/P95/max are unmeasured.

FLOAT bounded evidence: the prior designated creator 2rQ13KrAdDsAtd1LuKV1kGj6nFB4V4GsD9GAYKXi353T currently has one raw token unit at slot 474893164. The 49.89M owner acceptance fixture must not be represented as a current balance. Its historical acquisition/disposition remains unresolved. Two origin transaction retrieval formats and two recent transaction reads were truncated at the connector boundary. These are unusable complete proofs; no events are promoted from partial JSON. Twelve token-account signatures and twelve wallet signatures were retained as candidates only.

Read-only provider total: 70 logical requests, including four unusable truncated FLOAT transaction responses and bounded TRUMP owner-response recovery. No provider URLs/credentials are stored. No database writes or production mutations.

## Release gates and rollback

Do not promote. Finish creator recovery/launch support and material allocation control classification; perform fifteen complete authenticated scanner runs with category diversity, exact mint/slot/timestamp, provider consumption and end-to-end timings; obtain physical Android acceptance; require exact candidate SHA security/regression checks and explicit owner authorization. Use existing reviewed-SHA promotion and database-owner approval procedures in ri10-15-release-readiness.md. Never alter quotas or protection to run acceptance.

Before any future authorized promotion, re-read production deployment and aliases; preserve known-good tuple. Recorded baseline production is dpl_G9W8KEBCAGEn8SUonu1pGEYwHkCF / a24e1411d0e3749b6e1029ff98855d72c1a68078. Roll back only through approved known-good deployment controls, then verify alias/runtime tuple and smoke tests. No promotion or rollback executed in this sprint.
