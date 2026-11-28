# Premium HUD asset integration

Baseline: `521cae6a8da10ad5e508f6590fbd5cbfcafe6f0a`.
Scope: report presentation only. Homepage, scoring (15:30:35:20), coverage, saved-report persistence, APIs, security, providers, historical checkpoints and database code are unchanged.

## Three layers

1. Supplied header artwork (metallic wordmark, red slashes and close-up mascot), circuit texture, holographic platform and editable decorative SVG frames.
2. Live SVG arcs, gauges, charts and inline kit icons. Risk uses a 270-degree arc at (200,185), radius 145; coverage uses a 180-degree arc at (200,190), radius 145. Both normalize the full path to 100, so dash length is the measured percentage. Unassessed risk has no data arc.
3. Original interactive HTML controls, metadata, evidence and warnings. No example values or unsupported safety classifications are embedded in assets.

## Inventory (`public/premium-hud`)

| Asset | Integration |
| --- | --- |
| artwork/header-banner.png | Single branding strip; accessible description and independent back control; native aspect ratio |
| artwork/circuit-texture.png | Subdued report background |
| artwork/hologram-platform.png | SVG image below live risk gauge; native aspect ratio; screen blending |
| svg/risk-gauge-empty.svg | Decorative risk track and tick artwork; live risk overlay remains separate |
| svg/coverage-gauge-empty.svg | Decorative coverage track and ticks; live cyan-purple overlay remains separate |
| svg/card-cyan.svg | Security card and evidence metrics |
| svg/card-amber.svg | Holder card |
| svg/card-red.svg | Liquidity card and adverse-control metrics |
| svg/card-purple.svg | Creator card and movement branches |
| svg/panel-red.svg | Report shell, overview, liquidity, insights, key finding and evidence expander |
| svg/panel-cyan.svg | Security evidence frame |
| svg/panel-amber.svg | Holder evidence frame |
| svg/panel-purple.svg | Creator movement evidence frame |
| svg/tab-red.svg | Angular navigation frames; current tab has restrained live lighting |
| svg/icon-security.svg, icon-holders.svg, icon-liquidity.svg, icon-creator.svg | Supplied path geometry inlined in IntelligenceIcon to inherit accent colours |
| Other supplied artwork / SVG files | Retained source alternatives; not requested by report rendering; no duplicated branding |

Frames use nine-slice SVG borders instead of stretching whole raster images. Kit frame fills are removed to avoid bright expanded interiors. Decorative lighting is separate from risk classification. Reduced-motion overrides cover all transitions and animation. Report navigation and copy controls retain at least 44px height.

## Verification

- Existing 2,133 regression cases retained; one proportional-gauge test adds 0/25/50/75/100 and unavailable-state coverage: **2,134 passing, zero failures**.
- Optimized Next.js build passes. Existing autoprefixer warning at line 130 (`align-items:end`) and optional bigint native-binding fallback remain.
- Actual dashboard components and retained-evidence replay: five tabs at 320, 337, 360, 390, 449, 768, 1024, 1440px; no horizontal page overflow, missing raster images, browser errors or provider calls.
- Before/after captures at 390 and 1440px. Missing-data and severe-exit-cost cases captured separately. Critical warning and evidence expanders verified.
- Original IndexedDB save/load exercised through saved URL and browser refresh; displayed score retained. Copy returns the complete mint address.
- Runtime timing is a local harness diagnostic, not field Core Web Vitals or a claim of physical Android acceptance.

## Reproduce

With dependencies installed and a baseline checkout:

```bash
UI_BASELINE_ROOT=/absolute/baseline/mvp/wallet-signal node tests/hud-visual-harness.mjs
CHROMIUM_PATH=/absolute/chromium node tests/premium-hud-browser.mjs
npm run build
```

The browser runner requires Playwright in the environment; it adds no application dependency. Screenshots and detailed browser results are delivery artifacts rather than production routes. No new blockchain requests are made for styling. Production promotion is outside this change.
