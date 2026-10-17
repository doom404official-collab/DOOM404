# GLITCH v1.1 — Historical evidence reuse and calibration audit
Date: 2026-10-17. Source: live DOOM404 Intelligence Vault, Supabase public tables. Read-only inspection; no new RPC scans.

## Actual persisted cohort
- 98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump: three frozen top-20 snapshots, slots 457269064 (2026-10-15 14:22:07 UTC), 457273431 (14:37:44 UTC), 457305617 (16:33:49 UTC). The last two each have four stored five-wallet batches, all status partial and coverage.complete=false.
- Latest two holder scan jobs for this mint: status partial, updated 2026-10-17 06:53:26 and 06:53:20 UTC; directEdges 24 and 26 respectively; walletsTotal=20, walletsProviderExhausted=4, archivalCompletenessProven=false. Different jobs/snapshots are NOT interchangeable.
- SI404 mint 6STAMY3TQZ1okW3roz7K2mkHLyDXiATYkc6JiWzWpump: scan job status complete (2026-10-16 09:45:21 UTC), 3/3 wallets provider-exhausted, 2 direct edges, archivalCompletenessProven=false. Job complete is NOT proof of full archival coverage and only 3 wallets were evaluated.
- Holder evidence validation table: 62 verified, 13 pending, 75 total at audit time. This is 82.67% of stored validation rows, NOT total transaction-history completion.
- Creator attribution records (3) are all ONCHAIN_MATCH_PENDING_INDEPENDENT_REVIEW, not VERIFIED: 98kfF7... (creation 2026-09-15 19:20:20 UTC, checked 2026-10-14 06:06:20 UTC), HSUMi4r... (creation 2026-09-23 21:34:16 UTC), 6MnQ921... (creation 2026-10-04 20:31:18 UTC). Column name verified_creator does not override explicit status.
- No stored top-20 snapshot was found for Super Inu or DEADNET in this vault. No evidence of calibrated LP reserves, executable impact or creator sell-through was established from the inspected tables.

## Reuse decisions
1. Reuse frozen snapshots and the original 35-point network penalty outputs as historical benchmark fixtures, preserving exact snapshot ID/slot, provider evidence, exclusions and methodology version. Do not merge evidence across incompatible snapshots.
2. Recalculate the v1.1 top-20 concentration component only after extracting the actual holder_ranking share values from the matching frozen snapshot. Formula: full 35 at <=15%, zero at >=65%, linear between.
3. The previously reported network scores 12.36/35 and 13.79/35 belong to earlier historical snapshots; use as regression reference, not current final scores.
4. Creator identity remains incomplete under the explicit database status. Do not grant 20 creator-identification points just because verified_creator column is populated.
5. SI404 job completion may be used to test stopping-condition semantics but not full top-20 scoring, because only three wallets were investigated.
6. Token Security and Liquidity require independent verified RPC and pool evidence. Do not synthesize these from holder histories.

## Calibration result
Historical data REUSED, but four-attribute calibration NOT COMPLETE. The database confirms substantial partial holder evidence, not a fully labeled cross-attribute cohort. Keep calibrated=false and consolidated score withheld. Next action: snapshot-specific extraction and comparison against recorded 35-point network penalties; separately fill missing creator and liquidity evidence.
