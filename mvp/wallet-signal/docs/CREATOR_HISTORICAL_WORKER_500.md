# Creator Intelligence historical worker — implementation contract
Status: engineering preparation; NOT an active worker.

Source of truth: docs/GLITCH_SCORING_FRAMEWORK_V1_1.md (2026-10-17).

## Required stages
1. Creator identification (20): verified creation transaction, launchpad creator, mint authority, initialization signer, fee payer, metadata authority. Do not infer beneficial ownership.
2. Creator holdings (20): mint supply, attributable balances, historical allocation and transfers, evidence of wallet control.
3. Creator selling (30): verified swaps/sales and cumulative sell-through at 1h, 24h, 7d. Transfers do not count as sales. Complete windows required before declaring zero selling.
4. Previous launches (30): independently attributable mints, early sales, verified liquidity withdrawals, comparable launch windows. No prior launches is not automatically favorable.

## Worker contract
- Schedule hourly, with concurrency group creator-intelligence-investigation and no overlapping runs.
- Maximum 500 Helius requests per invocation across discovery and decoding, counting retries. Never exceed provider rate limits; adapt to 429 and retry-after.
- Persist durable per-mint/per-stage cursors, pending signatures, inspected signatures, evidence IDs, retries, last progress and completion in Supabase.
- Start with test mint 98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump, reuse existing indexed and verified origin evidence.
- Idempotent inserts, dedupe transaction signatures, bounded page sizes, exclusive lease and lease expiry.
- Track archival completeness separately for each creator wallet, launch and observation window.
- If history unavailable, mark UNKNOWN/INCOMPLETE; never turn missing data into zero sales or an independent wallet.
- Produce only evidence, coverage and timestamped attributes until v1.1 calibration and acceptance tests pass.
- Keep secrets server-side; no public production deployment without explicit approval.

## Activation gate
Current creator-evidence endpoint is GET-only and reads cached evidence. Before enabling a scheduled GitHub workflow, implement authenticated creator-scan-start/status/tick endpoints, durable jobs and migrations, historical launch/sale classification, tests, and preview smoke checks. Do not schedule a job that cannot safely resume and make progress.
