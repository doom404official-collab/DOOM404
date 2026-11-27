# Scanner production security and release runbook — 27 November 2026

Scope: doom404official-collab/DOOM404, integration/glitch-app-main-20261118, mvp/wallet-signal, Vercel doom404-wallet-signal. UI/scoring baseline fafbbae682debdb542218e5d75e59026bffd23e1 is frozen. No production promotion is authorized by this implementation.

## Admission and quotas

All 31 exported API handlers pass through durable admission before provider work. Existing worker/probe/internal authentication runs before shared-cache access. IP identity is accepted only in the expected Vercel project/environment/integration branch, using edge-overwritten forwarding headers; IPv4-mapped IPv6 coalesces and IPv6 is grouped by /64. HMAC identities use the existing server secret and are never exposed. IP-based limits are abuse controls, not person identification; shared networks share limits. No client-supplied identifier selects a budget.

PostgreSQL transaction advisory locking serializes admission/debits across instances. Server time is sampled after acquiring the lock. Fixed windows can admit up to two windows' capacity at a boundary; the independent per-second, per-request, concurrency and daily limits still apply. Counts debit before network, including failed provider attempts and retries; no refunds. Batch RPC charges every logical method toward minute/hour/day and per-request caps, while the one-second ceiling counts HTTP attempts. Store failure, invalid leases, deadline expiry or quota denial close expensive work; swallowed provider errors cannot restore permission. HTTP 429 includes Retry-After. Store/deadline failures return 503 with retry guidance. Invalid inputs and missing privileged authentication return 400/401 before admission/provider work.

| Resource | Limit |
|---|---|
| Client API requests, including cached/duplicate attempts | 60/minute; 360/hour; 1,500/day |
| Global API requests | 600/minute; 20,000/day |
| Active requests | 24 global; 8/client; 1 worker |
| RPC HTTP burst | 4/second |
| Aggregate RPC logical methods | 120/minute; 1,800/hour; 6,000/day |
| Helius subset | 30 logical/minute; 1,000/day |
| Alchemy/configured RPC subset | 120 logical/minute; 6,000/day; aggregate ceiling also applies |
| Market HTTP | 2/second; 60/minute; 500/hour; 1,500/day |
| Quote/other HTTP | 4/second; 30/minute; 120/hour; 500/day |
| Current token / creator / liquidity RPC per request | 4 / 6 / 10 |
| Current liquidity quote HTTP per request | 4 |
| Worker RPC per request | 30 normally; narrower probe policies 6–12 |
| Deadlines | 8–12s current/read routes; legacy 15–40s; worker up to 55s |
| Durable cached JSON | 10–45s by route; maximum 256KiB; original observation timestamps retained |

The policy table is the exact route inventory. Twenty-four active leases allow one user's normal parallel dashboard while bounding serverless pressure. Conservative launch ceilings protect free Helius capacity and cap Alchemy PAYG usage without changing billing; they are selected application ceilings, not assertions of provider-plan entitlements. Preview and production share this Scanner-only provider budget to prevent preview bypass; Media Agent state is separate. The daily maximum is 6,000 RPC logical methods, 1,500 market HTTP and 500 quote/other HTTP, subject to all shorter windows. RPC HTTP is no greater than logical methods, so maximum external attempts is 8,000/day, not a currency estimate. A complete cold dashboard typically uses several RPC methods plus one market request and four exit-quote requests; actual final runtime receipts must supply the observed normal consumption. The 500 quote/day cap permits at most 125 wholly uncached four-quote groups. Cache hits consume API admission but zero provider work. Provider plan credits vary by RPC method and are not identical to these counts. Launch capacity should be reviewed from actual counters before raising ceilings; only DB owner can change policies.

Only service_role can execute quota functions. Functions are SECURITY INVOKER with fixed pg_catalog search_path. Private tables have RLS and no anon/authenticated grants. Service role can update counters/leases/cache to operate admission, but cannot change policy or insert/update/delete production approvals. Existing service-role credentials remain trusted high-privilege server credentials; compromise of that credential is outside anonymous-client quota guarantees and requires rotation/incident response. No secret is sent to browsers or included in errors.

API workers require existing internal tokens, durable leases and provider budgets. No historical worker was restarted or schedule enabled. Legacy branch/manual diagnostic jobs are privileged administrative tools outside public Scanner serving and must remain inactive; do not use them to bypass the launch quotas. Existing creator reconciliation is cached-evidence-only, with its original gate preserved.

## Reviewed SHA and trust boundary

Three required native Vercel deployment checks are scanner-security, scanner-regression and scanner-reviewed-sha (published with Vercel - doom404-wallet-signal: prefix). Security/regression checks are produced on the exact integration SHA. The registered manual workflow glitch-evidence-validation-manual.yml now verifies the exact full SHA, checkout SHA, protected candidate runtime identity, project, branch and successful GitHub Actions checks. It cannot deploy or promote and has no Vercel production token. Missing/mismatched SHA, unrelated branch/project, failed/missing checks or missing owner authorization fails.

GitHub environment Production – doom404-wallet-signal has the owner as required reviewer, selected integration branch only, and administrator bypass disabled. Sole-owner configuration allows self-review because no second person exists; this is explicit owner authorization, not independent two-person review. Preview-negative dispatch uses authorize_production=false and must fail. Never approve production merely to test a positive fixture.

Vercel production sources permit only Git, restricted to this exact GitHub repository. No deploy hooks exist. Team inspection found only the owner. Native checks plus source policy reject ordinary alternative deployment paths; a Vercel owner can deliberately change policy/override controls, and GitHub administrators can edit workflows/status publishers. This is an administrative break-glass trust boundary, not a claim that owners cannot reconfigure their systems. Changes are auditable and must not be used for silent bypass.

A second runtime gate requires a database-owner-controlled release_approvals row matching the exact SHA AND deployment ID, fixed project/integration branch, owner identity and successful security/regression/reviewed run IDs. App service keys cannot write it. Production hostnames (including a promoted preview's custom/canonical aliases) require this record even if the artifact was built with preview environment metadata. Only unique protected preview hostnames are exempt from production approval. No production authorization row is created during this sprint. This blocks expensive APIs after an unauthorized promotion; static assets can still serve, so native Vercel controls remain necessary.

## Exact production promotion sequence (requires new explicit owner authorization)

1. Freeze the final tested GitHub SHA, protected unique preview URL and deployment ID. Confirm both scanner-security and scanner-regression jobs succeeded on that SHA. Recheck native required checks, Git-only production source policy, SSO protection, membership and absence of deploy hooks.
2. Obtain explicit owner authorization naming that exact candidate. Dispatch glitch-evidence-validation-manual.yml on the integration branch with reviewed_sha, candidate_deployment_id, candidate_url ending /, authorize_production=true. Owner reviews/approves the protected Production environment. The workflow validates and publishes scanner-reviewed-sha success; it does not promote.
3. DB owner independently records the same tuple with the successful security/regression/reviewed GitHub run IDs, approved=true, authorized_at=now(), expires_at='infinity' (or an explicitly managed maintenance policy). Infinity avoids silently expiring a live production release; revoke with approved=false. Do not place an automatic approval writer in the application or give service_role approval-write permission. Retain query receipt and linked owner authorization in the release record.
4. Confirm Vercel's three mandatory checks passed for this deployment, not another SHA. Promote the exact existing Git-built deployment through the owner-authorized native promotion flow; do not rebuild or substitute a different deployment. No production action is authorized until step 2's new owner instruction.
5. Verify production aliases point to that deployment and runtime headers match the approved SHA/deployment/project/branch. Run the smoke procedure below. Record the release in the handover.

## Bounded post-production smoke test

- Invalid mint: 400, zero provider work, no credential details.
- One reference-mint dashboard scan, no workers/history restart. Confirm existing score/coverage/findings and timestamps, normal target 10–15s, all four HUDs present.
- Repeat one current-token request within the durable cache window: HIT, zero provider calls and unchanged observation timestamp.
- Inspect admission counters/active leases and provider usage receipts; check no unbounded retries, server errors or public secret exposure. Read permissions/approval tuple; do not exhaust live quotas or inject store faults.
- Confirm protected preview still requires Vercel authentication. Confirm native checks block a missing/failed reviewed status without attempting production promotion.
- Fault/quota/concurrency/recovery scenarios belong in isolated tests, not destructive live load tests.

## Rollback

Record the prior approved security-hardened deployment before promotion. If the release fails, revoke its approval (approved=false) to close expensive APIs, preserve counters/history, then promote/rollback only an already approved hardened tuple with matching successful checks and documented owner authorization. Do not delete counters or relax quota/RLS/checks. This first hardened release has no hardened production predecessor: the older production artifact predates these controls, so keep APIs fail-closed and repair forward rather than silently reverting to unmetered code. An owner-directed emergency fallback requires a separate documented decision. Re-enabling a revoked tuple requires owner review and smoke tests.

## Validation

31 focused JS security/release cases; integrated suite 2,103 passed. Isolated real PostgreSQL tests cover roles/RLS, invoker functions, normal admission, exhaustion/recovery, duplicate/concurrency, worker/provider limits, lease expiry, retained cache timestamps and exact production approval tuples. A disposable CI PostgreSQL service separately proves two backend sessions cannot double-spend the final per-request unit or duplicate lease. No external provider calls are used for these fixtures. Temporary remote validation schema/functions were removed; production approvals remain empty. Final runtime/build/CI receipts are recorded in the completion report. UI/scoring files are byte-identical to the accepted baseline; no package/dependency change.

## First candidate runtime receipt

Candidate 299df946c6aece14dcd5c987a04834899a3af33e, deployment dpl_GA7ziWQTg6GZLm2XR8mRKv7TTBdF passed GitHub run 45966051089, including two independent PostgreSQL backends (90,91), one admitted/one duplicate and one final-unit debit admitted/one REQUEST_BUDGET. Negative manual run 45966320430 failed OWNER_AUTHORIZATION_REQUIRED and published failure. All three native Vercel checks were then imported and verified in Blocking production mode; Git-only exact-repository production sources were saved. Checks take effect for subsequent production deployments; final candidate is built after this configuration.

One dashboard scan completed initial independent sources in 5.87s, current liquidity 6.59s, creator 6.74s, first mint 2.64s. Response-reported usage was 5 RPC HTTP/5 logical, one market request, zero executable quotes/other. A separate current-token request consumed one RPC; immediate repeat was durable HIT with zero providers and identical observedAt 2026-11-27T08:33:00.485Z. Full scan showed retained Top-20 24.54%, four HUDs, overall 12/100 at 82.5% coverage; live market figures may change without scoring-code changes. Final candidate identity/runtime is recorded in the completion report.
