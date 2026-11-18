# Holder network restoration: observed evidence only

Restores TOP20_NETWORK_V1 from `feature/holder-concentration-scoring`, source commit
`11314e2ff7d5e050592c6eae2b08ea76faa797a1`, introduced in `0e5c25c0665c7d7a693b2ba7de3fcd5381afae29`
and eligibility-adjusted in `159aa00ab219ebbe0fa356af6568ab09b51727e5`.

The 35-point engine preserves rounded direct, repeated (three unique signatures),
indirect and largest-cluster penalties. It derives counts from explicit transfer
edges, not supplied network statistics. Original hub policy (>100 distinct peers)
is retained, including original direct-pair counting before hub path filtering.
Infrastructure is excluded from both direct pairs and paths. No shared-control
inference is made. Raw balances and mint total supply are used for cluster shares.

Historical aggregate fixtures reproduce 12.36 at snapshot
`8bfd2ea655c9d363b53f50c0416f58bd5e8ef313ddea0d67af42fc3eafa7d34a`, slot457273431,
and 13.79 at `1379bcb43b07be4b783dd4aa67bcabab50cc363cf36c4ca31c943204ccda0153`,
slot457305617. Their graph realizations/signatures are synthetic test data, NOT
recovered live transaction records and NOT proof of historical replay/persistence.

## Producer and persistence contract

The existing bounded history decoder extracts parsed SOL/SPL/Token-2022 transfers
from successful confirmed RPC transactions. Token owners and asset mint must agree
in transaction-local pre/post token balance metadata. Unknown owner resolution,
missing instruction evidence or unsupported raw instructions fail closed.
No balance delta or co-occurrence is treated as a transfer.

Versioned `checkpoint.networkEvidence` rides the existing JSON checkpoint/lease
commit path. No database schema migration, new credential, additional RPC request
or live database mutation is part of this code change. Retention is bounded at
20,000 decoded signatures and 20,000 deduplicated transfer records. Overflow is
explicitly incomplete and withholds the observed score, never silently dropping
edges and scoring the remainder. Snapshot identity and per-signature record counts
must match. This is a size bound, not a risk-scoring threshold.

Legacy checked transactions were not retained in this format. They remain unknown;
this change does not silently rescan them, migrate records, or award an empty-graph
score. Recovery/backfill requires a separately bounded execution plan.

## Read contract and remaining gates

`assessment.observedNetwork` is a separate observed-evidence result exposed by the
existing holder assessment endpoint. It covers ONLY inspected holder-history
transactions. Shared intermediaries can be connected when explicit transfer edges
occur in those inspected transactions; intermediary histories are not independently
scanned, and missing historical paths remain unknown. Pending/failed coverage is
reported; provider exhaustion never establishes archive completeness.

The v1.1 network component, creator/team exposure, independence and overall final
scores remain withheld. `historyComplete` and `calibrated` remain false. Independent
archive evidence, infrastructure classification, creator attribution, independence
and real-token calibration remain release gates. A passing build proves none of
live persistence, complete history, real-token replay or production acceptance.
