# Simplified Token Intelligence report — 28 November 2026

Scope: report presentation only, superseding premium HUD references. Baseline: `1ded576ce963b7645db435a4f002b6384fae3d4d`. Integration branch: `integration/glitch-app-main-20261118`. No production promotion.

The report uses a text wordmark, decorative non-interactive scanner mark, equal-width Overview/Security/Holders/Liquidity/Creator navigation, proportional semicircular risk gauge, weighted coverage progress bar, individual attribute risk bars, deterministic material findings and collapsed supporting evidence. Retained historical observations and investigation controls remain inside supporting evidence. The shared footer contains the existing product disclaimer once.

No qualitative score bands were added because this sprint does not authorize new thresholds. Missing evidence produces an insufficient-evidence display, never an invented zero-risk score. Partial scores retain the observed-risk-floor qualifier. Coverage is explicitly separate from safety; criterion counts are omitted rather than inferred from weighted percentages. Critical findings are visible before collapsed technical evidence, including when evidence is insufficient. The first three material findings and every critical finding remain expanded. Duplicate flag IDs and unavailable noncritical assessments do not inflate material risk counts.

Secure saved-report reload remains the existing mechanism. No refresh action that starts new investigations was added. Mint, observation time and copying are available in Token information. The scanner symbol is decorative and does not claim an additional function.

## Verification

- All original 2,134 regression cases retained; superseded visual assertions updated for the approved simplified design. Three focused presentation tests added: section order/score immutability, risk count/deduplication/critical visibility, and missing-evidence handling.
- 2,137 tests pass; Next production build passes. Evidence-persistence integration reports SKIPPED_NOT_OPTED_IN, as in the existing non-provider build workflow; no provider calls were made to enable it.
- Actual React dashboard compiled in an isolated browser harness with retained deterministic fixtures. No external requests allowed.
- All five tabs checked at 320, 337, 360, 390, 449, 768, 1024 and 1440 CSS pixels. No horizontal overflow. Navigation targets are at least 44px high. Primary score, navigation and attribute numbers do not clip.
- Missing/zero evidence, long metadata and critical-exit fixtures exercised on all tabs at all eight widths. Metadata fallback and duplicate identity covered by render tests. Gauge/progress values cover 0/25/50/75/100. Exit costs retain fee basis and distinguish missing/unexecutable from zero.
- Attribute navigation, evidence expansion, saved report reload and mint clipboard copy pass. Browser page errors: zero; external/provider requests: zero.
- Mobile and desktop screenshots use deterministic replay, not a new live blockchain receipt or physical Android acceptance.

## Parity

Homepage source, artwork, input controls, animation and report-opening flow are unchanged. Added styles are report-scoped, including a report-only parent rule requiring a direct `.ti-report` child. No scoring, criterion weights, coverage calculations, provider/decoder, API/security/quota, saved-report persistence, database, checkpoint or worker implementation changed. Approved weights remain 15/30/35/20. Replay risk/coverage remain 15.15/100 and 83%, with identical per-attribute values before and after.

## Performance comparison

Same local deterministic browser harness, one navigation per width; development bundles, not production benchmarks:

| 390px overview | Previous | Simplified |
| --- | ---: | ---: |
| Initial DOM elements | 310 | 253 |
| Resource requests | 9 | 1 |
| Transferred resources | 3,107,816 bytes | 2,807,465 bytes |
| Local load sample | 133ms | 61ms |

Timing is environment-dependent and cannot establish production latency improvement. The report no longer loads the premium HUD image/font assets in the harness.

Remaining release acceptance: physical Android review and owner visual acceptance. Production remains unchanged. Deployment identifiers and exact commit verification are supplied in the handover.
