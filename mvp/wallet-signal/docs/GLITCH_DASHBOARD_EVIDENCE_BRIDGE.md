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

## Overall Scoring boundary review — October 29 local preparation

Canonical register remains Issue #66 O01–O05, five top-level gates. Retained
acceptance is 2/5; local fixes do not promote additional gates. The approved formula
remains four equal 25% attributes, with final score withheld unless every required
attribute is complete, calibrated and finite within [0,100]. No ranking policy,
weights, thresholds or Unknown-to-zero fallback is introduced.

Reproduced before correction: four differently keyed rows all declaring the same
attribute could score 100; inherited map entries could score 100; exported weights
were mutable; mutating nested output metadata changed the original input. Canonical
attribute/component definitions are now frozen. consolidate reads only own data
properties from ordinary keyed maps, rejects arrays/inherited rows/accessors,
rejects explicit foreign attribute or methodology version, and detaches returned
metadata. Existing legacy scalar records without declared identity/version remain
supported; caller id/weight metadata still cannot override canonical id/25% weights.
Duplicate map keys already discarded by an upstream JSON parser cannot be detected
here. Arrays are not a supported assessment contract. Explicit duplicated attribute
identities under different canonical keys fail closed rather than being relabelled.

No universal timestamp/provenance schema is invented at consolidation: these are
existing producer-adapter gates. The public scalar API still trusts literal complete
and calibrated assertions; it is not an authentication/provenance verifier. All
current real attribute adapters remain calibrated:false. The actual persisted
GET projection, adapter and rendered dashboard tests prove forged stored scalar
scores are not forwarded, independentlyReviewed must be literal true, stale creator
identity/evidence is not compatible, and unavailable evidence stays Pending. They
use synthetic storage only, with no hosted credentials or calls. Component-level
source/timestamp/coverage and authentic calibration remain release prerequisites.

| Gate | Retained status | Remaining acceptance / scoped work |
|---|---|---|
| O01 | Accepted | Four canonical attributes and 25% weights preserved; definitions now immutable. |
| O02 | Accepted | Existing withholding retained; identity/version/accessor/immutability defects fixed locally, pending parent review. |
| O03 | Open | Three findings remain hardcoded. Need an approved evidence eligibility, cross-attribute priority and tie-breaking rule, including how Unknown/contradictory/stale evidence affects selection. No consequential ranking chosen. |
| O04 | Open | Diverse authentic token calibration and independent false-positive/negative review. |
| O05 | Open | Approved end-to-end assessment against reference evidence and release checks. |

The smallest O03 decision is a versioned rule for selecting and ordering at most
three supported findings across the four attributes, including deterministic ties
and whether an Unknown coverage finding may outrank an observed finding. Existing
hardcoded concentration/history/coverage text is not evidence that such a policy
was approved. Ranking implementation and live validation remain separate from this
boundary correction. No automatic scan, publication, production or score promotion.

Verification: 23 focused tests passed, including 1,296 valid scalar combinations
with unchanged formula/output and inherited-flag rejection. Final offline-guarded
`npm run build` passed 1,751 tests, compilation, lint and type checks. The optional
hosted persistence check reported `SKIPPED_NOT_OPTED_IN`; no live acceptance is
claimed. API/render coverage uses the actual GET projection and server-rendered
components with synthetic transport, not a live browser or deployment.

## Dashboard integration review — October 29, local only

Reconciled draft PR #72 (`3120957926c52c93b7e47bff83eef388879cc785`):
existing border-box, map focus and cluster sizing changes were already present.
Only the missing fullscreen containing-block correction was selectively reused.
Later Holder map, frozen observation, Liquidity freshness and Token Security
literal-evidence guards remain intact. No blanket merge was performed.

The actual-page regression reproduced an inspection stuck after mint editing.
Inspection now has request ownership, cancellation on edit/unmount, exact returned
mint checks and a 45-second client deadline covering headers and bodies. Late
non-cooperative responses cannot publish, release a newer request's busy state or
restore an old assessment. Server work already dispatched is not guaranteed to
stop by browser cancellation. No retry, worker start or new provider call is added.
Persisted-scoring polling now rejects older same-mint responses. Rendering refreshes
at the existing one-hour boundaries for fee, Creator, Holder and Liquidity inputs;
stale Creator balance/launch observations are withheld.

Navigation order is Token Security, Holder, Liquidity, Creator, independently of
canonical scoring order. Black/red theme, original mascot, existing scan/ready-glow
styles and map are preserved. Static observations no longer claim to be ranked
Top 3 findings or assert an active historical scan. O03's ranking policy stays open.
Verified fee N/A explanatory text now agrees with its label.

Verification: final offline-guarded `npm run build` passed 1,752 tests, compilation,
lint and types. Hosted persistence validation was SKIPPED_NOT_OPTED_IN. New actual
page browser script passed 42 checks at 320/393/1440 widths: delayed primary response,
mint edits, repeated navigation, keyboard focus, fullscreen bounds, wrong-mint/error
responses, body timeout, late completion, unmount/return, scoring poll ordering and
fee expiry. Retained Holder/Liquidity page script passed 32 checks at 390/1280,
including map drilldown, repeated navigation, partial history, frozen observation
mismatch, provider errors and stale Liquidity. All API responses were synthetic;
server outbound/API handlers were independently blocked. Zero browser exceptions
or forbidden requests. Screenshots are review artifacts, not real Android evidence.
The initial full run caught one outdated exact-call regex in the existing smoke
suite; it was updated for the scoped cancellation race. Final runs have no failures.

| Gate | Retained status | Remaining acceptance |
|---|---|---|
| D01 | Accepted | GET-only whitelisted bridge unchanged. |
| D02 | Accepted | Existing identity/Unknown gates retained; new client ordering and expiry guards await review. |
| D03 | Open | Scoped labels/order fixed offline; full evidence-label acceptance remains subject to review. |
| D04 | Open | Retained synthetic graph/drilldown tests pass; authentic graph/snapshot acceptance remains open. |
| D05 | Open | Reproducible desktop/mobile-width mock QA passes; actual Android, assistive-technology and owner UX acceptance not established. |
| D06 | Open | Authentic persisted producer → API → dashboard acceptance requires the separate evidence/access gates. |

Fixed denominator remains six, accepted 2/6. No push, Preview/production deployment,
workflow dispatch, scoring policy, hosted mutation or authentic scan occurred.
