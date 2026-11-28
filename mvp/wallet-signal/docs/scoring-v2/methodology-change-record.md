# GLITCH practical risk methodology 2.0 — 26 November 2026

Authorized by the owner's “Final Scoring Rationalization and Product Completion” mandate. The accepted reconciliation baseline is unchanged. Token Security, Holder Intelligence, Liquidity & Safety and Creator Intelligence each retain 25% of the overall weight.

## Reading the revised assessment

Version 1.1 displayed safety-style points only after complete evidence and calibration. Version 2.0 displays **observed risk points: higher means more observed risk**. This is a control/exposure index, not fraud probability, a price forecast or a trading instruction. It must not be compared directly with the previous 100/100 provisional security score.

The denominator remains the full 100 points in each category. Missing criteria neither receive safety points nor cause normalization of the known subset. Known adverse observations may contribute risk points while coverage remains partial. Such a number is explicitly an **observed risk floor**, never a low-risk verdict. Overall numeric presentation is withheld below 60% evidence coverage or below 65% Token Security coverage. The UI always shows coverage and unresolved material evidence. Critical flags remain visible independently of the aggregate.

Coverage is the sum of criterion weights whose stated scope is measured, divided by total criterion weights. It is not a claim that every transaction or beneficial owner has been investigated. Transaction counts, scope, timestamps and historical limitations remain separate. A current observation expires after one hour; live liquidity/wallet response caches last 60 seconds. The accepted frozen holder snapshot remains a dated operational baseline, not a claim of current atomic observations.

## Criterion disposition

| Previous criterion | Disposition and new producer | Weight / rationale |
|---|---|---|
| Mint authority | Retain as supply dilution | 30; active authority adds 30 risk points. Revocation must be explicit. |
| Freeze authority | Merge with transfer controls | Part of 35-point transfer/fee friction; overlapping transfer-blocking powers use the maximum, never a sum. |
| Fee schedule | Retain as configured maximum percentage, with epoch-resolved or identical stored schedules | Part of transfer/fee friction. Existing percentage boundaries retained: 0, 1, 3, 5%. This is not a transfer simulation. |
| Fee configuration authority | Merge with transfer/fee friction | An authority that can raise fees reaches this component's maximum. No second charge for the same fee risk. |
| Previously unscored permanent delegate | Add holder asset seizure | 35; mint-level seizure is a distinct power from dilution and exit friction. |
| Other Token-2022 controls | Include in transfer/fee friction; unsupported fields stay unknown | Hooks, pausing, default-frozen and non-transferable configuration are inspected. Metadata controls do not imply asset seizure. Confidential public-transfer semantics are separated. |
| Top-20 concentration | Retain in eligible distribution | 70 combined with largest-holder pressure; retains the 15–65% Top-20 ramp. |
| Largest eligible holder | Add within distribution, not an additional score | 2–20% ramp. Use max(Top-20 pressure, largest-holder pressure), preventing correlated concentration double counting. |
| Connected-wallet network | Replace exhaustive-history gate with scoped observed material relationships | 30; connected eligible exposure ramps from 0 to 20%. Positive validated observations contribute a risk floor; incomplete historical coverage is not absence evidence. |
| Creator/team exposure in Holder | Remove duplicate numerical criterion | Attributed creator exposure belongs in Creator Intelligence. Unknown team ownership remains a limitation, never inferred. |
| Holder breadth / absolute independence | Remove unverifiable numerical criterion | Absolute independence cannot be established from interactions. Coordination/funding evidence stays in observed relationships and flags. |
| Available USD liquidity | Replace reserve estimate with protocol exit-cost/depth calculation | Combined 50-point exit-cost component; no unverified USD oracle is needed for native quote-asset trade sizes. |
| Reference sell impact | Merge into exit cost/depth | Max of 100-SOL-equivalent impact ramp 1–15% and 10-SOL-equivalent ramp 1–5%. USDC-quoted pools use 10,000/1,000 USDC. No separate reward for the same reserves/impact relationship. |
| Liquidity / market cap | Retain as reserve / fully diluted valuation buffer | 15; existing 2–20% boundaries. Both values use the same quote asset and state. It is explicitly not circulating market capitalization. |
| LP security | Replace generic “locked/burned” label with current withdrawal exposure | 35; current outstanding LP claims use each protocol's accounting denominator. A small verified upper bound can resolve material withdrawal exposure without inventing historical burn provenance. A large bound without custody/lock proof remains unassessed, not verified unsafe. |
| Pool concentration | Remove unverified all-pool numerical claim; retain bounded provider observation/limitation | Provider-returned pools are not exhaustive or independently controlled. One pool's score must not be presented as the entire token market. |
| 30-day stability | Remove mandatory numerical gate | A long history does not establish present executable liquidity or withdrawal permissions. Current measurable depth/control replaces the safety inference; dated history remains supporting evidence. |
| Creator identification | Make a prerequisite, not a positive safety score | Verified identity is not benign behavior. A reviewed cached match or transaction-local creation proof is required. Assigned on-chain creator role is distinguished from off-chain identity. |
| Creator holdings | Retain direct attributed wallet exposure | 60; retains 2–20% exposure boundaries. No inferred team or common ownership. Mint/owner observation slots remain explicit. |
| Lifetime/window selling percentage | Replace with observed disposal behavior against a fixed verified purchase baseline | 40; market sales and external transfers are separate. Market-sale pressure reaches maximum at 50% of the fixed baseline; non-sale external transfer pressure is discounted to one quarter and cannot establish selling or ownership. Burns contribute no selling risk. Partial histories remain partial coverage. |
| Previous launches | Remove unproven comparable-outcomes numerical score | Positively attributed material past behavior remains a flag when available. Absence of attributable launches earns no points. Funding and prior-launch gaps remain explicit. |

Security transfer/fee friction uses the maximum known pressure: active freeze/restriction/mutable fee = 35; otherwise immutable configured fee percentage uses 0/20/52/80/100% of that component at the retained boundaries. No one permission is scored twice. Unknown extension semantics prevent absence points.

Liquidity withdrawal pressure ramps from 1–20% of current reserves. A current LP-claim upper bound <=1% is sufficient to bound material present redemption exposure. Larger upper bounds require actual custody/withdrawal evidence before scoring that criterion. Protocol administration and upgrades are separate limitations; no immutable-pool claim is made.

## Minimum evidence and early stopping

* Security: current mint owner/base state plus validated known extension layouts. Stop once these controls and applicable fee configuration are measured; unknown layouts fail closed. Do not simulate every transfer to score a configured permission.
* Holders: retain canonical slot 474029636 and separate classification slot 474029653. Recompute concentration and largest holder from that accepted snapshot. Reuse only compatible verified relationships. Exclude incidental non-reference assets, program sponsors, SOL dust below 0.05 SOL and reference-token transfers below 0.01% of mint supply. Observed links never establish common ownership. No broad history restart.
* Liquidity: same-context pool, vault, mint and fee/config accounts; verify program, discriminators, referenced accounts, token authority and protocol formulas. PumpSwap uses signed virtual quote reserves and subtracts fee buckets from redeemable reserves. Raydium CPMM uses its own fee, reserve and LP accounting. CLMM/AMM-v4/other architectures do not inherit constant-product rules. Stop after bounded current calculations; do not spend LQ-09 historical reads on present depth.
* Creator: reuse 4,656 processed signatures, transaction-local launch evidence and typed ledger events. Refresh current wallet inventory independently. On a cache miss, allow at most one oldest indexed transaction candidate and require an actual mint-birth/protocol-creation proof. Never paginate automatically. A recent verified burn is a burn, not a sale. No lifetime selling percentage is emitted.

## Consumption and execution controls

Normal current mint inspection uses one RPC, followed by independent evidence sources. Concentration account and authority classifications use bounded batches rather than 20 individual account requests (four RPC calls maximum for the normal sample). Current PumpSwap collection is bounded to three logical RPC calls, Raydium CPMM to two, plus explicitly metered retries/fallback attempts. Creator origin lookup is limited to one indexed historical query on a cache miss, with no pagination. Current wallet inventory is one call after attribution.

Nine-second server evidence reads and 12-second client reads remain bounded. Explicit manual history inspection retains its existing separate limit. The four overall weights are unchanged; older evidence, workflows, REVIEWED_SHA controls and production authorization are preserved.

`GLITCH_PROVIDER_USAGE` logs record response-scoped RPC HTTP attempts, logical calls, methods, sanitized provider categories and request IDs. Corresponding public headers allow UI counts. Shared requests are charged to their initiator. Cancelled client responses may omit client-side totals; server completion logs are the authoritative trace. No endpoints, keys or worker state are included.

LQ-09 remains at two historical account reads consumed, one authorized read remaining. This revision consumes none of that allowance.

## Calibration interpretation

Retained live account bytes are checked against independent integer equations and known permissions. Established issuer-controlled assets must show issuer powers without a scam claim. A shallow pool must show a proportionately larger reference exit cost than a deeper pool, regardless of the token's brand. Synthetic stress tests are identified as such and are not substitutes for live-token acceptance. Unknown or malformed evidence must withhold coverage and any low-risk conclusion. Product calibration/viewport/performance receipts are recorded separately from this methodology authorization record.

## Executable-route fallback

When a pool architecture is not decoded locally, the existing Alchemy API key may obtain quote-only `/swap/v2/order` observations. Maximum: one 0.01-SOL baseline quote and three defined reference sell quotes; no taker, transaction build, execute or submission is requested. A 403/unsupported entitlement stops immediately; no subscription is purchased or credentials changed. The quoted token amounts are scaled from the small baseline and explicitly approximate SOL notionals. Provider-reported price impact is labelled separately from SDK exit cost including fees. It does not certify fee coverage, LP controls, circulating valuation or an exhaustive pool inventory. Those missing criteria remain unassessed. Requests use the same nine-second source deadline and are metered separately from RPC and market-data requests.

Normal old-snapshot reconstruction/lineage fetching is no longer automatic. Retained historical evidence remains available on explicit expansion. No October checkpoint or evidence is deleted or changed.

## Current holder samples outside the frozen baseline

For other mints the existing concentration endpoint now batches the mint and sampled token accounts in one RPC context. It groups on-curve authorities and excludes PDA/program and incinerator authorities before deriving a **lower bound** from the returned largest-account sample. Discovery and balance slots are retained separately; the full ranking is not called atomic or complete. Owner aggregation outside the sample and custodian attribution remain limitations.

Distribution coverage is 70 × observed eligible authorities / 20, capped at 70, rather than treating a short sample as a full ranked inventory. A verified positive lower bound that already saturates the distribution-risk component can stop collection: additional holdings cannot reduce that maximum observed pressure. Risk points themselves are never normalized by the sampled count. The accepted frozen canonical snapshot retains its full 70-point distribution coverage and unchanged provenance.

## Release hardening

Swap-disable flags (and a future Raydium CPMM opening time) make reference exits unavailable with maximum observed exit pressure, rather than emitting benign executable figures. A non-owner vault delegate with nonzero spending allowance prevents LP supply alone from bounding withdrawal exposure and produces a critical flag. Raydium vault token programs and mint decimals must match the pool state.

The indexed origin request explicitly accepts parsed legacy, v0 and v1 transaction envelopes. The live provider returned -32015 with the prior version-0 ceiling; this is a transaction-version compatibility error, not evidence of missing provider entitlement. Unknown future envelope versions are rejected. Strict mint birth, protocol instruction, account roles and signer requirements remain unchanged. The narrow cryptographic burn verifier still supports only its existing legacy/v0 message shapes.

The existing deployment names its Alchemy integration ALCHEMY_SOLANA_ARCHIVE_RPC_URL; bounded index/quote consumers reuse it with no credential changes. Normal pool selection prefers the inspected mint as base with a supported SOL/USDC quote, rather than blindly selecting a pool where the inspected mint is an unrelated quote asset.

Current RPC capacity failures may use the existing Alchemy endpoint after Helius; explicit configured fallback lists take precedence. Each actual attempt is metered. The 429/fallback and response-size boundaries have offline regression checks. No endpoint value, credential or billing configuration changed.

Signed quote price impact is retained. Negative values have no adverse-risk interpretation until their sign semantics are independently verified; they do not silently become either favorable zero or an absolute adverse percentage. Small positive percentages retain up to six decimals in evidence displays, including nonzero LP claims.

## Executable quote recovery indicator

Live Alchemy route responses demonstrated changing signed provider impacts. Instead of blocking measurable current depth on an undocumented sign convention, fallback scoring now uses **quoted SOL recovery shortfall**: `max(0, (reference SOL lamports - quoted SOL output) / reference SOL lamports × 100)`. Reference token quantities scale from the exact output of a 0.01-SOL buy quote. The output token mint and amount are validated on each sell quote. This directly measures quoted recovery against that explicit, approximate notional baseline; it is not an independently established spot price impact, atomic market observation, or guarantee of complete fee coverage. Signed provider impact is retained separately. The existing 50-point exit component and thresholds are unchanged, so there is no second score for correlated depth/impact. Missing LP/valuation controls remain unassessed. Retained live USDC outputs re-derive a zero shortfall against this baseline, consistent with a deep executable route; the independent PumpSwap/Raydium state calculations remain distinct.

An unavailable protocol reference sale carries a null impact measurement and explicit unavailable state, with decisive adverse exit pressure. Critical exit/control flags are prioritized in every attribute, independently of the aggregate risk floor.
