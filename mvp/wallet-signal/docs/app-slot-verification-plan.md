# APP transaction-slot verification

Reference transaction: `aLBaPgDsc5x6FgpirNJnmgFEjfz2DveHQ3xaKYeypdZq26WiYt7wjoVfNqgWMfiKR6DYveZmGiYAnN6Y593SXZ7`.

1. Fetch the existing signature with the configured server-side Helius RPC `getTransaction` method. Request supported transaction versions.
2. Record only slot, blockTime, success status, and program IDs. Never log RPC URL or API credentials.
3. Compare slot/blockTime with Pump.fun historical release/IDL evidence. A documentation publication date alone does not establish on-chain activation.
4. Validate historical 20-account `create_v2` semantics before extending the strict decoder.
5. Keep APP indexed-only until verified; do not rescan its history.

Status: research plan only. No live request or deployment triggered.
