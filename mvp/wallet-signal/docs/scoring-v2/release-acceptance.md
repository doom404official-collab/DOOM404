# GLITCH practical scoring release candidate — 26 November 2026

The accepted engineering baseline was retained. This delivery implements the owner's authorized scoring rationalization; it does not claim exhaustive blockchain investigation or fraud-probability calibration. Four overall category weights remain 25% each. The consolidated criterion disposition and exact formulas are in `methodology-change-record.md`.

## Observed reference assessment

Live browser observation at liquidity slot **474107032** and creator-wallet slot **474107048**:

| Category | Observed risk / 100 | Defined-criterion coverage |
|---|---:|---:|
| Token Security | 0 | 100% |
| Holder Intelligence | 17.28 | 70% |
| Liquidity & Safety | 24.43 | 100% |
| Creator Intelligence | 6.64 | 60% |
| Overall | 12.09 | 82.5% |

Higher means more observed risk. This is a risk floor with partial evidence, not a safety rating. The old safety-style 100/100 Token Security score and the new risk-style 0/100 are not directly comparable. Current liquidity coverage means the three defined pool-specific criteria, not all pools, historical authorization or immutable administration. Live values change with pool state. Retained-account replay yields 12.07 at its earlier observation, rather than overwriting the live receipt.

Current facts include eligible Top-20 concentration 24.5379%, largest holder 2.1151%, one verified material relationship involving 2.6224% of supply, and direct creator holdings of 599,036.011328 tokens. Wallet relationships are not common-ownership findings. Current outstanding LP claims are approximately **0.003645%**, not zero. Global operation controls, program-upgrade scope, bounded pool inventory and the historical creator-fee recipient discrepancy remain explicit.

## Calibration acceptance

Expected differences were established from actual account states and executable quote observations, not just different score outputs:

* USDC: active mint/freeze controls produce 65 control-risk points. Wrapped SOL and the reference mint have no such mint-level powers and produce zero at the observed state. PYUSD's mint/freeze/permanent-delegate/mutable-control configuration reaches 100; this identifies issuer powers, not issuer misconduct.
* A same-context shallow Raydium CPMM SOL/USDC pool produces about 66.1%, 95.1% and 99.49% exit cost at 1/10/100 SOL equivalents. The deeper reference PumpSwap pool produces about 1.02%, 1.69% and 7.84%. SDK output is checked against integer constant-product and fee calculations. Pool-level evidence is not mislabeled as token-wide liquidity.
* Existing Alchemy quote-only USDC routes produce approximately 0.00012%, 0.00020% and 0.00072% provider-reported price impact at those reference sizes. Provider impact is explicitly separate from protocol fee-inclusive exit cost; LP controls stay unknown for this fallback.
* PYUSD's live bounded sample contains a 53.8344% authority and 68.5457% observed aggregate share. Eligible program classification is separately observed; custodians remain unclassified and beneficial ownership is not inferred. Saturating positive concentration can stop further collection without claiming a full ranking.
* Recent launch `EGiRRwVAKQrD8gk7e4hNyPCRormANKiNo5uKtY46pump` has a transaction-local Pump.fun creation proof at slot **474084555**, timestamp **1795682430**, signature `GJoH3fzjPTt7wJofgbs7MPFLewVabv2HwfKW6MaU8Z7gfX2ZDWzdENDwvcEeMC62sKNBXsr3ELmqDfH6ZpgRZ7S`. One oldest indexed transaction and one current wallet read establish the assigned creator role and zero current direct-wallet balance. Zero current holdings do not prove an absence of historical disposals.
* Reference creator evidence reuses 4,656 processed signatures and six individually verified events. A targeted recent burn of 2,144.637484 tokens has an independently verified signed message; successful execution/finalization remains RPC evidence. Burns, external transfers and recovered sales are separate classes. No lifetime selling percentage is emitted from the incomplete acquisition denominator.

Raw fixtures, public reduced live projections and replay assertions are retained in `tests/fixtures/` and `calibration-report.json`. Calibration validates the stated control/exposure methodology and monotonic differences, not future outcomes or a statistically fitted scam probability.

## Product and technical acceptance

The deployed candidate at commit `311cef9ce6fd68be31516e369b553caf0360ce31` was exercised in the authenticated browser. All five tabs and expandable evidence worked; distinct flags remained stable across repeated updates. First mint evidence arrived at **1.22 seconds**, independent initial sources at **5.87 seconds**, current liquidity at **2.83 seconds**, and creator-wallet evidence at **6.27 seconds**, measured from inspection start. The scan reported five RPC attempts and one market-data request. Connector elapsed times include access/transport overhead and are not substituted for browser measurements.

Responsive browser checks at **449px** and **337px CSS widths** found no document overflow. Tabs could be reached, selected and horizontally scrolled; supporting evidence remained readable. These are real narrow CSS-layout checks using browser zoom, not Android user-agent/device emulation. DevTools are disabled by organization policy; no physical Android device was available. Physical touch/keyboard verification remains a device-coverage limitation and must not be reported as passed.

The first integrated run passed 2,042/2,045 tests. Three obsolete read-count/sequential-fetch assertions were corrected and passed focused checks. The deployed build then passed **2,045/2,045**. Subsequent actual live defects received focused tests: immutable risk flags, disabled swaps, external vault delegates, transaction-version ceilings, existing-provider failover and nonzero LP display precision. The final deployment build is the authoritative integrated result for the frozen commit; its SHA, deployment ID and result are recorded in the handover after deployment.

No database schema or credentials changed. Two new evidence objects were appended to the existing liquidity and creator checkpoint JSON; original snapshots, historical jobs, transaction observations and provenance were preserved. No historical worker was restarted, no workflow/reviewed-SHA control was changed, and no production deployment was requested. LQ-09 consumed **zero additional historical account reads**; one authorized read remains.

## Material evidence limits and release controls

Holder relationship coverage remains bounded. Creator acquisitions, sales, funding and previous-launch attribution remain incomplete; unobserved events do not receive safety credit. The historical fee-recipient mismatch remains unresolved, independently of current executable depth and LP claims. Quote-only fallback does not certify LP locks, upgrade authority or an all-pool inventory. Unknown protocol/extension/transaction configurations fail closed.

The product delivers useful numerical control/exposure assessments with these limits visible. It must not be described as a complete forensic history, a safety guarantee, a fraud predictor, or a BUY/SELL recommendation. Production promotion remains separately gated on final deployed acceptance and owner authorization. Physical Android acceptance is not silently inferred from responsive desktop rendering.

## Final live corrections

The freeze candidate at `519307214049c0b7c57fb64b0283783d3e34e300` passed 2,051 integrated tests and produced a 12.09 / 82.5% reference assessment in 3.76 seconds. Its normal recent-launch scan produced 20.42 observed risk at 81.63% coverage, with a decisive 100-SOL-reference exit-unavailable flag, demonstrating a material risk difference from the reference pool.

The same live pass found a quote-only null-LP rendering error. It was corrected with a consumer/renderer regression: missing withdrawal controls retain 50% liquidity coverage, without a client exception or invented LP evidence. An unavailable sale now carries an explicit unavailable state and maximum exit-risk pressure; its impact percentage is null, rather than a fictional 100% execution cost. Eleven focused checks passed across the affected consumer, renderer and protocol calculations. The successor deployment is checked after this correction.

The corrected quote-only path rendered without a client exception. Further live observations showed negative provider impact signs, so the authorized fallback methodology uses directly measurable quoted recovery against its disclosed small-buy baseline. Provider impact, SDK exit cost and quote recovery are explicitly different measures. A renderer regression also verifies that critical flags precede ordinary evidence limitations. These changes do not award coverage to LP/valuation controls or change any overall category weight.
