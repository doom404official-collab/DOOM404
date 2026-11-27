# Final HUD and UI acceptance — 27 November 2026

Baseline: `8fd5e53acd75c42adb0b1e04cf3cfeca784c30d8`, verified as integration branch HEAD before changes. Repository: doom404official-collab/DOOM404; branch: integration/glitch-app-main-20261118. Scope is the Scanner only, under mvp/wallet-signal.

## Acceptance

| Item | Implementation and acceptance |
| --- | --- |
| HUD-01 | Compact shield icon; six independent evidence-driven mint, seizure, freeze, restriction, fee and other privilege statuses. Repeated score and coverage removed. Missing/malformed controls remain unresolved. Shield is decorative, not a safety claim. |
| HUD-02 | Three independent concentric rings, each 0–100%, with exact formatted legend values. No invented nodes, additive ownership partition or common-ownership claim. Eligible wallet count remains in graphic; historical connection map remains expandable. |
| HUD-03 | Explicit protocol mappings including PumpSwap, Solana Token Program, Solana Token-2022 and Raydium CPMM. Unknown identifiers remain unidentified; exact raw identifiers remain in blockchain details. Alchemy executable routes are identified as routes, not attributed to a specific venue. |
| HUD-04 | Zero-based labeled percentage axis, dynamic scale, consistent bars, values above bars, trade sizes below. Missing/unexecutable quotes are unavailable. Fee basis follows actual quote method. Five compact liquidity observations retained. |
| HUD-05 | Attributed creator wallet, direct share, Copy and Explorer retained. Four distinct incoming/burn/outgoing/exchange event indicators; one shared unit label. Event totals remain separate historical categories; zero recovered sales does not prove no sales. |
| HUD-06 | Short factual annotations; detailed methodology and provenance expandable. One shared dashboard disclaimer retained. Material limitations and partial labels preserved. |
| HUD-07 | Smaller cards, padding and graphics. Security findings arranged in two columns. Large blank shield column removed. Criterion contribution details collapsed. Interactive controls retain at least 44px targets. |
| HUD-08 | Assessment, critical flags, HUD, other flags, criterion contributions, blockchain details, methodology and consolidated gaps. Existing severity classes retained; critical flags removed from the second flag list. |
| HUD-09 | Actual current on-chain, retained holder snapshot, historical evidence retention and provider market timestamps displayed separately. Frozen holder time is never replaced by scan time; sampled holders are labeled as a sample observation. Invalid/missing time is unavailable. |
| UI-14 | Opaque #09090d sticky header, z-index 30, isolation and opaque lower shadow. At <=500px viewport height header returns to normal flow to protect controls. Fullscreen retains its own scroll container and focus handling. |
| UI-15 | Deterministic control findings, exact exit-cost labels, creator direct exposure and event totals replace generic directions to technical evidence. No AI. |

## Validation and limits

- Focused rendering, formatting, critical-order and sparse-data checks pass. Integrated regression: 2,072 passed; zero failures.
- Next production build passes; route first-load JavaScript remains 222 kB (baseline 222 kB); page route remains 119 kB. No dependency changes.
- Actual React dashboard replay: four HUDs at 320, 337, 360, 390, 449, 768, 1024 and 1440 CSS pixels, 32/32 without document overflow. Each retains one shared disclaimer and an opaque header. Separate short-landscape check confirms normal-flow header; fullscreen opens/closes; evidence expands; Copy reports success; Explorer URL matches creator.
- Browser screenshots are explicitly deterministic replay, not new blockchain receipts. The replay's quantities and dates are test fixtures. Before images use accepted baseline source; after images use this sprint source. Mobile and desktop screenshots plus the Overall dashboard are included in handover artifacts.
- Local Chromium is unavailable in this executor. Browser QA therefore uses the supported preview bridge and cloud browser with real compiled React components and no API/provider calls. The harness is reproducible using `UI_BASELINE_ROOT` and `UI_ARTIFACT_DIR` with tests/hud-visual-harness.mjs. A missing baseline must not be represented as a before comparison.
- Scoring, criteria, evidence eligibility, protocol decoders, provider integrations, checkpoints, workers and database files are unchanged. Existing engine fixture remains 12.15 observed risk and 82.5% coverage for the original replay; additional event-display fixtures are explicitly synthetic.
- No provider requests are introduced by these presentation modules. Offline/replay checks consume zero provider requests. One invalid accepted-preview request returned 400 with all provider usage counters zero. One invalid existing-production request returned 404. Final live preview observation and usage are recorded separately in the handover receipt.
- Previous 3.39s live creator response is a prior measurement, not inferred from this build or browser replay. The initial 10–15s target is preserved architecturally; one final reference scan is a bounded spot check, not a load test or latency guarantee.

## Production security gates — NOT closed

Vercel project prj_AbsbiTw8Kc8axGpZ3FFpH9VvDS4e; team team_W9lyvBNaIxptPUUXDVQnvOkf. Preview SSO remains enabled (all_except_custom_domains). No authentication, credential, billing or firewall settings were changed.

### Reviewed commit enforcement

Source inspection found reviewed-SHA equality checks in manual historical worker workflows. Those checks do not enforce Scanner production promotion. No production promotion workflow was found in this checkout. Git commit metadata matching the preview demonstrates provenance, not enforcement of a promotion gate. Therefore universal reviewed-SHA enforcement cannot be claimed.

Pre-promotion safeguard: keep production promotion disabled for this task. Record the owner-authorized full SHA; require the integration ref, checkout SHA, staged production deployment Git SHA, reviewed SHA, project and team to match before a release operator may promote. A changed branch HEAD must not silently replace the authorized SHA. The owner must approve the exact reviewed release only after staging acceptance. This is an operational hold until a protected release path is demonstrated; it is not a claim that Vercel administrators are technically prevented from direct promotion.

### Rate limits and abuse protection

Authenticated active firewall inspection returned no custom firewall configuration; only default platform protections apply. Default platform protection is not evidence of a configured application quota. Source has no cross-instance per-client or project-wide API rate limiter. Current liquidity and creator routes use per-instance 20-key active maps, same-key deduplication, 60s caches capped at 100 entries, 9s deadlines and abort handling. These controls do not establish global rate limits across serverless instances. RPC retries/fallbacks are bounded per connection; provider usage instrumentation counts consumption and does not enforce a global provider budget. Internal holder scan start remains gated; no workers were run.

Invalid mint validation occurs before provider work. Server-side provider and database credentials remain in server modules; no credential values were fetched or included in handover. Local client-source/build checks are not a substitute for staged production configuration inspection.

Current production is dpl_G9W8KEBCAGEn8SUonu1pGEYwHkCF at main SHA a24e1411d0e3749b6e1029ff98855d72c1a68078. Its /api/token-current?mint=invalid returns 404; it is not the accepted Scanner build. Testing that deployment cannot certify new Scanner production API behavior.

Required before public release: establish and inspect effective durable per-client/API quotas, aggregate provider budget enforcement, over-limit response behavior and fail-closed behavior when the limiter cannot evaluate a request. Do not rely on in-memory maps as a distributed quota. Configure this through the existing approved infrastructure; no new paid service or credentials are authorized by this sprint. Record exact configured limits in the release receipt. This remains a genuine release blocker, not a UI defect.

## Production promotion sequence

1. Close durable quota and protected reviewed-SHA release-path gaps; record effective configuration and reviewed full SHA. Obtain owner production authorization.
2. Stage that exact commit as a production-environment build without assigning production domains. Do not relabel a preview test as production-environment acceptance.
3. Compare reviewed SHA, checkout, deployment metadata, branch, project and team. Abort on any mismatch; never substitute latest HEAD automatically.
4. On the staged URL, perform one invalid request per public scan route and verify 400/422 with zero provider work; run one reference scan and record values, timings and provider usage. Inspect delivered client bundles and errors for accidental secret exposure without printing credentials.
5. Exercise the limiter through its supported bounded test mechanism or isolated policy fixture: a configured allowed request, an over-quota request returning 429, an unavailable-limiter case that fails closed, and bounded same-key concurrency. Do not generate production traffic merely to exhaust quotas. Verify global budget behavior across instances in controlled staging, not through uncontrolled load.
6. Recheck the exact staged deployment and promote only after the owner's authorization and successful acceptance. Immediately run one valid reference scan and one invalid request, inspect errors/429s and counters, check mobile navigation/fullscreen and historical timestamp labeling. Roll back to the recorded prior production deployment on a material failure.

No production promotion was executed. AI remains deferred.
