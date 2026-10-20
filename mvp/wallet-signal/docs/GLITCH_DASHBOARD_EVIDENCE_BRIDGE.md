# Dashboard evidence bridge (development only)

The dashboard now reads existing persisted worker evidence through the GET-only
`/api/scoring-evidence?mint=...` route. This route uses the existing server-side
Supabase configuration; it never enqueues work, writes rows, provisions tables,
changes credentials, or runs chain RPC. Missing tables/configuration and malformed
or unsupported checkpoints remain explicitly unavailable, independently by source.

Supported producers at implementation time:
- Creator worker branch: `creator_intelligence_jobs` (`mint,status,stage,state,updated_at`).
- Liquidity worker branch: `liquidity_evidence_checkpoints` (`mint,evidence,updated_at`), schemaVersion 1.
- Existing holder assessment route with v1.1 components, mint/job/update identity
  and matching live/cached holder account-owner sets and exact balances.

Only whitelist projections reach the browser. Raw checkpoints, leases, provider
errors, candidate transactions, secrets and internal job state are not returned.
Creator attribution is bound to the requested mint by the creator-evidence route.
The page cancels/ignores obsolete evidence requests on token changes, and adapters
reject mismatching mint/creator/job/snapshot identities. Undated, future or older
than 1 hour checkpoint updates are not eligible for score inputs; this follows the
existing tokenInsights stale-display boundary, not a new score calibration.

What is actually connected:
- Existing backend holder component evidence/reasons, with current concentration
  retained from the current mint. Queue completion is not historical completeness.
- Independently reviewed creator identity; persisted wallet-balance observations
  and attributed prior-launch counts are displayed as observations, not scores.
- Creator selling windows may feed the existing engine only with complete creator
  history, a complete positive verified initial-allocation denominator, all three
  eligible windows, matching calculated percentages and a matching reviewed creator.
- Persisted liquidity pool-check counts and explicit missing evidence are visible.
  The current stage 1 producer explicitly forbids verified-depth/LP/final-score
  claims, so no liquidity points are fabricated.
- Token2022 absent fee extension can be N/A only when mint-bound and verified.
  Newer configured fee is not treated as the currently effective fee schedule.

Remaining producer work, not claimed fixed:
- Authoritative holder network/classification/creator-linkage scoring evidence.
- Attribution-complete creator holdings, independently verified initial allocation
  and complete sale history, comparable previous-launch outcome points.
- Verified executable depth/valuation, LP control, independent pools, sell impact
  and 30-day reserve history.
- Calibration acceptance and live cross-token/mobile/desktop validation.

All calibration flags and final-score gates remain unchanged. Unit tests and a
Next build do not prove live database visibility, persistence, archival history,
or a successful Preview deployment. No production rollout is authorized here.
