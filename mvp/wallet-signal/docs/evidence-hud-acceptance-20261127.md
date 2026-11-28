# Evidence Intelligence HUD acceptance — 27 November 2026

Baseline: 9f68b937b328ff583f845de66a832a798cf2fdb1; preview dpl_A6j7pjpt5CZCBxvQUAhXskc8ThT7.

Presentation-only implementation: Wallet Radar (aggregate fallback), Exit Intelligence bars, Token Movement Tracker, Cybersecurity Shield. All values consume the existing assessment. No scoring, classifications, evidence producers, RPC, cache, API, dependencies, or unrelated applications changed.

Holder metrics do not expose eligible individual nodes and verified material edges in the accepted presentation contract. The default therefore uses an aggregate radar; it does not invent a wallet graph. The retained historical map remains in its existing collapsed section. Creator token units require actual result.decimals; unknown decimals withhold converted quantities. Exact decimal formatting uses BigInt. Quotes retain their existing executable status and measurement basis; missing is distinct from zero.

Header overlay is removed by keeping the compact dashboard identity header in normal flow with an opaque background. Fullscreen controls and focus logic are unchanged. New technical details are collapsed, with content-visibility deferring offscreen layout. Original retained audit sections remain intact. One generic disclaimer remains in the shared footer; attribute limitations are grouped at the bottom of attribute content.

Validation:
- Full smoke regression: 2,068 passed, 0 failed.
- Next production build: passed.
- Seven CSS frame widths (320, 337, 360, 390, 412, 768, 1440), all four panels: 28/28 without horizontal document overflow after fixing a 2px legacy viewport-width overflow under scrollbars.
- Native expandable blockchain details verified in browser.
- Browser screenshots include deterministic replay before/after (explicitly labelled fixtures), plus live baseline and final preview evidence when available.
- Engine regression confirms unchanged fixture risk 12.15 and coverage 82.5%. Engine source files remain byte-identical to baseline; no score thresholds introduced.
- Token quantity tests include 0, 9, 12 and unknown decimals, quantities beyond JS safe integer precision, missing values, zero cost and unexecutable quotes.
- Baseline first-load JS: 218 kB; HUD: 222 kB (+4 kB, approximately 1.8%). Page route bundle: 116 → 119 kB. Same installed dependencies.
- Local 800-panel SSR replay mean: baseline 0.316 ms/panel, HUD 0.558 ms/panel; approximately +0.242 ms. This is an offline rendering diagnostic, not live RPC latency.
- Provider usage: zero network calls introduced in HUD/formatting modules; producer and route files unchanged. Scan latency is not inferred from SSR timing.

Release gates: physical Android acceptance; reviewed-SHA enforcement for the exact release commit; existing production API rate-limit verification. No production promotion authorized by this sprint.

Reference limitation: attached DOOM404_Evidence_HUD_Designs.pdf was unavailable in this session. Implementation follows the detailed written brief; visual matching to that PDF remains unverified.
