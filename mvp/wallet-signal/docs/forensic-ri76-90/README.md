# RI-76–RI-90 independent forensic evidence

Baseline: 704c59e425167882089583a668a33f72977538d9. Production remains unpromoted.

Original finalized creation receipts were independently retrieved using standard public Solana RPC after resolving signatures from retained Vault diagnostics. Raw RPC request parameters and results are retained beside this file. No creator identity is injected into production code.

Demonstrated corrections:

* ANSEM: read-only, non-signing Jito DontFront remaining account was incorrectly required to be quote_control. The protocol layout is verified after removing only the exact observed sentinel with its transaction metadata checks.
* CATE: current prohibition on new cashback launches was incorrectly used to reject successful historical creation receipts. Cashback-enabled decoding requires successful, signed transaction-local mint birth context; malformed/synthetic or failed requests remain rejected.
* DCTY: protocol CPI holder rewards were excluded by the narrow direct-transfer decoder. The new proof checks the pinned official distribute_fee_to_holders discriminator, protocol PDAs, amount vector, source ownership, every destination ownership and exact raw balance changes. New ATA variants require corresponding parsed initialization. This yields 26 verified EXTERNAL_RECEIPT events totalling 2,006,484,278 raw units across the independently retrieved 34-signature account history.
* Verified creation receipts with large execution logs could exceed the unchanged cache size ceiling. Only reverified genesis receipts omit logs; transaction instructions, balances, signatures and origin verification remain intact.
* Revision8 expires completed older snapshots through the existing exact-row CAS. Active workers and immutable receipts are preserved.

`node scripts/replay-forensic-reference.mjs` replays the independent receipts through the normal bounded investigation pipeline. This is recorded RPC replay, not a hosted-live or lifetime-coverage claim. It recovers ANSEM allocation evidence and all26 DCTY reward receipts across three continuation windows, without increasing the18-request per-window ceiling.

Important open findings:

* DCTY also has an initial62,657,905.488883-token inflow and four later token outflows inside routed trades. Current reward decoding does not qualify the routed acquisition/disposition settlement. Do not mark those movements as purchases/sales merely from balance changes or instruction log names.
* Basket's inspected current/retained token-account receipts leave zero token balance while collecting creator fees. Zero recovered token events in those receipts is not evidence of prior selling or lifetime inactivity. Only100 recent signatures were fetched independently; creation and unknown closed-account history remain separate scopes.
* Current Basket classification identifies five distinct unresolved balances comprising approximately28.17% of supply. The historical Android eight-account membership is unavailable. Economic control, full release/admin/upgrade paths and complete account membership remain open.
* The scoring split remains60 points current attributed holdings,40 historical disposals. Recovered events do not automatically complete the historical criterion. No arbitrary coverage credit is awarded.

Validation:2389 regression tests and production build pass.112 geometry checks across five tabs and eight widths pass using production components/CSS with clearly labelled synthetic risk inputs; physical Android acceptance is outstanding. Detailed final handover separately records hosted candidate, live validation, performance and CI status.
