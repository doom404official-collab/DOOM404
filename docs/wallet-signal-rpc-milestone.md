# Wallet Signal — RPC reliability (Milestone 1)

Status: **isolated implementation; integration and live validation pending**.

- Transport: `src/lib/solanaRpc.js` (framework-independent ESM).
- Supports HTTPS endpoint failover, per-request timeout, retry of 429/5xx, transient JSON-RPC and network failures, exponential backoff.
- Does **not** retry invalid method/parameter errors.
- Do not put provider secrets into browser code; use a server-side proxy for private RPC credentials.
- Wire the transport into the existing wallet scanner only after confirming the actual deployed application source path.
- Acceptance tests: healthy RPC, HTTP 429, HTTP 500, timeout, unreachable primary, invalid params, all endpoints down.
- UI requirement: never show “SIGNAL READY” when RPC collection failed or only partially completed.
- Do not merge or deploy without explicit owner approval.
