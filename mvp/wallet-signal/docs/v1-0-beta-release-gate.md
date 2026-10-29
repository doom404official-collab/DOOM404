# Wallet Signal v1.0 — beta release gate

## Automated checks
- RPC unit tests, Next.js production build, invalid-address handling, Mainnet API smoke tests, and empty-history wallet checks are configured in `.github/workflows/wallet-signal-v1-0.yml`.
- Verify the **latest** workflow run after every new commit. Earlier green checks do not validate subsequent changes.
- The optional `WALLET_SIGNAL_ACTIVE_TEST_ADDRESS` must be set to a known public active address to include an active wallet in the diversity suite. It is currently optional, so a green workflow alone does **not** prove active-wallet coverage.
- High-volume wallet testing and partial RPC failure simulation remain outstanding.

## Manual acceptance review
- Mobile: wallet input and Analyze button visible without scrolling at the agreed target viewport; scanning message remains visible.
- Desktop: hero, mascot, wallet input, and analysis controls align without overlap.
- Mascot blends into background without a visible image rectangle or ring.
- Scanning state never claims the signal is ready; successful evidence-qualified scans display the green mascot glow.
- Failed or partial scans, empty wallets, and insufficient coverage do not show a green signal.
- Changing the address during an in-flight scan must not show results from the previous address.
- Confirm data labels explain that activity observations are not fraud detection, investment recommendations, or wallet-safety guarantees.

## Release decision
No production merge, Vercel deployment, or domain switch is authorized. Require latest CI pass, active/high-volume test evidence, mobile/desktop screenshots, and explicit founder approval before beta release.

## GLITCH offline release-candidate audit — 2026-10-29

This section supersedes the older Wallet-only scope above for the GLITCH candidate;
it does not retire the existing Wallet product or authorize release. Source candidate
`a15f89818dcc72f4e5f5d1bb9c4693bf8ea5aba8` is exactly 16 commits ahead, zero behind
published `a47b8a46929c61b9cb4a56f128b303337e85725b` by local ancestry. Clean at audit
start. No remote ref refresh, hosted configuration read or live probe occurred.
The remote SHA must be reread before any separately authorized publication.

### Reconciliation and activation boundary

The 16 commits selectively prepare Creator sessions/provisioning, Liquidity inactive
fencing/admission, Token Security evidence guards, Overall consolidation and Dashboard
correctness. PR67/70/71/72 findings were selectively reconciled in the existing attribute
registers; none is blanket-merged. PR68/69 and retained Liquidity reconciliation are
covered by the existing Liquidity register. No new claim that draft ancestry is merged.
Main/assessment refs and historical checkpoints remain untouched.

Local diff against published baseline contains **no changes** to `.github`, active API
routes, `db/`, package manifest or lockfile. There is no tracked `vercel.json`, root
package manifest or Next configuration introducing crons/build hooks. Vercel project
build/ignore/deployment settings therefore cannot be established from this repository.
The prepared Creator endpoint has no active app/route/workflow importer. Its factory
is disabled by default and its server-only export is retained. Liquidity composition
and SQL live only in `docs/proposals/liquidity-inactive`; there is no runtime import
from active app/workflow paths. No new automatic migration runner exists.

### Source workflow inventory and concurrency limits

| Source entry | Trigger / scope | Release implication |
|---|---|---|
| Scanner checks, Sprint1 validation, evidence-validation tests, Liquidity worker tests | Existing pull-request path filters; no explicit repository-secret injection | Expected PR74 checks for this cumulative diff. Scanner includes disposable PostgreSQL. No live dispatch. |
| Holder auto | Hourly minute 17 plus manual; assessment Preview target | Shares `glitch-holder-investigation` with manual worker; source branch check is broader than pinned recovery. Does not establish global writer quiescence. |
| Holder manual | Disabled default; separate assessment/recovery modes | Recovery requires exact branch/SHA, attempt1, sealed versions/window; no new attempt authorized. |
| Evidence worker | Every 30 minutes plus manual; assessment ref | Separate `glitch-evidence-validation` concurrency; can overlap other workers. Database fencing remains necessary. |
| Creator worker | Hourly minute 23 plus manual | `glitch-creator-history` group; existing broad service-role worker enqueues before tick and uses legacy save contract. Inactive V2 is not a deployed fix. |
| Liquidity evidence | Manual, Liquidity feature ref | Per-mint concurrency, service-role persistence. Not shared with historical/replay groups. |
| Liquidity history / replay | Manual, Liquidity feature ref | Separate per-pool history/replay groups; not mutual distributed fencing. Retained canonical artifacts are legacy, not the new admission protocol. |
| Holder checkpoint; Creator origin/buy/indexed; Diab; Liquidity focused/archive; Solscan diagnostic | Existing manual diagnostic paths; Solscan also has narrowly filtered assessment push | Some lack ref/concurrency restrictions. These are credential-bearing live tools, not offline acceptance. Do not dispatch during release review. |
| Legacy Wallet and Creator/Holder unit workflows | Named feature-branch pushes/manual | Not recovery-branch push activation. Older Wallet acceptance may make live reads; not part of this offline audit. |

No reusable-workflow or repository-dispatch trigger was found in this checkout.
Scheduled runs normally use default-branch definitions; current default-branch source,
enabled state, external callers and ongoing runs were not refreshed. Parent's earlier
Holder UI inspection established six enabled workflows at that time, not current
quiescence. Local absence of other workflows is not proof of their absence on main.
No schedule, concurrency group, permissions or dispatch input was changed.

### CI and Preview credential boundary

Normal PR tests inject no Supabase/Helius/Creator passwords explicitly. Checkout still
uses an Actions token, and several workflows retain floating action tags, default
checkout credential persistence and `npm install` despite a committed lockfile.
These are reproducibility/least-privilege hardening items, not evidence of compromise.
Do not claim the workflow has a network sandbox: this audit's outbound guard is local.

Vercel automatic builds are a separate secret-bearing boundary. Parent previously
verified four sensitive `CREATOR_TEST_DB_*` values scoped to **wallet-signal Preview,
recovery branch**, and global Preview Supabase/Helius configuration. Values were never
read here. The root DOOM404 project's current secret scope is unverified. Both projects
historically create Previews on branch publication; neither may be assumed harmless
because a route is disabled. Build/dependency/test code executes with its configured
build environment. No public client module references the new machine/DB credentials;
server configuration is lazy and disabled factories do not read secrets.

`npm run build` still includes a legacy persistence probe, but it requires the exact
`feature/creator-origin-cb02e` Preview ref AND `CREATOR_EVIDENCE_PERSIST_ONCE=true`.
It does not enable on the recovery ref. The probe is not removed or run live here.
Current hosted flags, limits, protection, branch bindings, token scopes and deployment
settings remain unexecuted verification prerequisites; retained metadata is not fresh
permission to deploy.

### Migration compatibility, preservation and rollback

- Creator job V2: distinct unapplied revision/fencing proposal and default-disabled
  adapter/runner. The verified legacy catalog lacks revision fencing and permits same-owner
  saves. Cutover requires quiescing every writer, exact catalog/privilege checks and an
  approved compatibility transition. Never re-enable legacy writers as automatic rollback.
- Creator evidence: parent previously applied closed test schema/deny-subject guards,
  with three passworded logins at connection limit 0. Current live state is not reverified.
  Server-session SQL, route registration, machine-password provisioning and sealed test
  windows remain separate gates. Superseded manual-token proposals remain historical;
  do not apply both alternatives. Windows rehearsal was blocked by RemoteSigned policy;
  no execution-policy bypass or successful Windows provisioning is claimed.
- Liquidity: `liquidity-hosted-retained-admin-alternative.sql` is the pending ac65c786
  alternative, SHA256 `8877e82ebe545f25f35f03e638b998145684dc6fea092bf13f3710834a62f811`.
  The older `liquidity-hosted-closed-setup.sql` is the rejected incompatible policy candidate,
  not the executable choice. Reader extension SHA256
  `fea52ca3bca09e2044f0af77ed67b27ea0b228d8cc29c3ab3dfafc7bbf1e7e3c`;
  accounting extension SHA256 `61d926973cc0380ea399413636904cb0a3bf0307ffebe9a4a472f4ce9ca569b2`.
  All are unapplied. Retained-admin trust, narrow identities/TLS, catalog drift, grants,
  writer quiescence and admission require approval/verification. No broad table grant fixes.
- Holder: do not retry the two reconciled timeout runs. Preserve both original checkpoint
  hashes/content and expired leases; support SU-527089 and new bounded-run approval remain
  external gates. Preserve Liquidity 87/60 signature lineage and Creator 7,189-request history.
- Rollback: before SQL commit, transaction rollback; after uncertain commit/upload/save,
  stop and independently reconcile. Do not auto-retry or equate timeout/disconnect with
  rollback. After deployment, a code rollback does not revoke credentials, expire existing
  deployments, undo database writes or repair evidence. Prefer fail-stop/closed admission,
  preserve receipts/checkpoints, and obtain approval for any corrective mutation.

### Retention and observability

Existing artifacts have bounded retention: Holder recovery receipts 3 days, checkpoint
reports 7 days, several diagnostics/Liquidity artifacts 30 days. These are not durable
archive guarantees. Historical artifacts may expire; no fresh download or retention
extension was performed. Permanent replay/attempt claims and quarantine receipts must
not be deleted to regain a retry. Any archive/retention change is a separate decision.

Local tests cover redacted error codes, unknown mutation outcomes, budgets, cancellation,
lease loss, source hashes, quarantine and admission. Existing runbooks prescribe safe
receipt/readback reconciliation. Hosted monitoring, alert delivery, backup/restore,
resource headroom, latency and incident drills are not established by those tests.
No new alerts, logging service, infrastructure or costs are activated. Do not log raw
checkpoints, credentials, provider URLs, Auth sessions or private exception bodies.

### Fixed acceptance totals and decisions

| Register | Retained accepted count | Remaining boundary |
|---|---:|---|
| Holder H01–H11 | 4/11 | Authentic history/ownership, safe persistence recovery, calibration/release. |
| Creator CI01–CI18 | Tracker 4/18; historical parent audit independently substantiated 3/18 | Preserve the explicit distinction; no new gate accepted. Secure flow, authentic allocation/settlement/history and calibration remain open. |
| Liquidity LQ01–LQ15 | 7/15 | Setup/fencing/admission and authentic custody/history/calibration. |
| Token Security TS01–TS09 | 4/9 | TS07 capped-fee methodology decision, authentic behavior and calibration. |
| Overall O01–O05 | 2/5 | Versioned insight-selection rule, calibration and reference acceptance. |
| Dashboard D01–D06 | 2/6 | Final GLITCH/Wallet hierarchy, real-device/accessibility and authentic producer delivery. |
| Release R01–R06 | Retained 1/6 | R01 is historical CI evidence, not CI for this unpublished candidate. R02–R06 remain open. |

Do not sum these denominators: gates have cross-attribute dependencies. No production-ready
claim follows from this audit. The smallest decision set is final navigation scope,
TS07/O03 policy choices, exact Creator/Liquidity access/cutover proposals, and separately
bounded live acceptance. Infrastructure provisioning is not implicit in code review.

### Minimal proposed publication path — NOT executed

1. Parent reviews this exact local tree and cumulative diff from a47b8a4, including the
   inactive proposals. Freshly verify remote expected head and both Vercel project scopes
   using non-decrypted metadata only; stop on drift.
2. Obtain explicit approval for that exact commit's guarded fast-forward publication and
   normal secret-bearing disabled Preview builds. No route/workflow registration, migration,
   flag, credential change, manual dispatch or production release is bundled.
3. After approved push only, verify exact remote SHA, the four applicable PR workflows and
   both Preview results. Check that disabled synthetic/recovery paths remain closed without
   executing providers or workers. A deployment or CI failure is not permission to retry
   mutations or broaden configuration.
4. Present separate finite access/cutover and bounded integration approvals. Actual Auth,
   Storage, DB, provider and reference-token acceptance remains outside this offline package.

### Final local verification and R01–R06 disposition

`NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--require=/tmp/holder-offline-guard.cjs npm run build`
from `mvp/wallet-signal` passed **1,756 tests**, compilation, lint and type checks.
The first invocation was made from repository root, which has no package manifest;
it executed no tests. The corrected application-directory invocation passed.
Optional hosted persistence was `SKIPPED_NOT_OPTED_IN`. No package installation or
network dependency audit was performed. Existing deprecation warnings are not release
acceptance and were not suppressed.

Compiled mocked-route suites passed **94 cases**: recovery window 11, isolation 17,
ordinary routes 13, evidence 27, frozen 8, reported Liquidity 5, LP holders 4 and transaction
proof 9. Commands: `node scripts/check-holder-{recovery-window,recovery-isolation,
ordinary-routes,evidence-route,frozen-route}.mjs` and
`node scripts/check-liquidity-{reported-route,lp-holder-route,transaction-proof-route}.mjs`,
each with the same outbound guard. The workflow response Python suite passed 10 tests.
No real environment credentials were used: compiled harnesses install synthetic config
and transports. Built `.next/static` JavaScript contains zero references to
CREATOR_TEST_DB_, CREATOR_MACHINE_UPLOAD_PASSWORD, CREATOR_MACHINE_READBACK_PASSWORD
or SUPABASE_SERVICE_ROLE_KEY. This is a bounded source/bundle check, not proof against
all possible credential leakage or a hosted secret audit.

Unchanged disposable SQL/crypto/terminal results are reused from their existing
proposal registers, not rerun or represented as current hosted acceptance. Dashboard's
48+32 actual-page checks and isolated expiry suite are retained from a15f898; no UI
changed in this audit. No new defect justified runtime/workflow/schema modifications.

| Release gate | Disposition |
|---|---|
| R01 | Retained historical acceptance; this candidate has local aggregate checks only. Exact-head hosted CI/Preview pending approved publication. |
| R02 | Open: effective access, secret scopes, migration/cutover and security acceptance. |
| R03 | Open: authentic high-volume/performance/provider limits; Holder timeout unresolved. |
| R04 | Open: actual monitoring, retention/restore and rollback/incident acceptance. |
| R05 | Open: this audit prepares the manifest/decision package; dependency and release review still required. |
| R06 | Open: explicit production authorization and post-release acceptance. |

Proposed publication approval wording: “Publish the exact reviewed local audit candidate
by guarded fast-forward to the existing recovery branch/PR74 and allow its normal
CI and disabled Preview builds in the two existing Vercel projects, after confirming
non-decrypted secret scopes and the expected remote head. No activation, migration,
credential change, live validation, worker dispatch, production promotion or merge.”
This wording is a proposal only; no approval is inferred and nothing was published.
