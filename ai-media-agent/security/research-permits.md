# RC-15 research permits

Deployment Protection remains the preview authentication boundary. POST /api/research-permit accepts only a mint and an optional existing signed permit. It creates a backend UUID session, a separate random permit nonce, issuedAt, expiresAt, research purpose and an opaque HMAC client binding. A domain-separated HMAC-SHA256 signature uses the configured editorial secret. The browser obtains the permit automatically and sends its server session to /api/investigate.

Permits last exactly five minutes, permit at most 15 seconds of future issue-time skew, and never accept an expired timestamp. Reissuing requires a valid existing permit and preserves its original issue time, expiry and session, changing only the random nonce. Caller-selected session IDs are forbidden at issuance. New investigations receive new server sessions.

Research validates signature, purpose, mint, session, time and client binding before durable admission, then validates again after admission before any evidence/RPC/editorial work. Admission atomically consumes the session ID, so a different nonce cannot replay the same session. After two-hour cleanup every permit for that session is already expired and cannot obtain a later validity window. No indefinite session ledger is needed. No operational nonce rewrite is required.

Permit issuance uses a separate durable purpose budget with the existing six-per-client and 30-global hourly limits, five-second database timeout and two-hour nonce retention. Research/narration budgets and permissions are unchanged. The SQL migration changes only purpose constraints and the function's allowlist. Existing RLS, service-role-only grants, invoker execution, lock scope and bounded cleanup are preserved.

Client identity uses only Vercel's x-vercel-forwarded-for metadata. Missing, multiple or invalid IP values fail closed; equivalent IPv6 spellings canonicalize before keyed hashing. A second domain-separated HMAC conceals the admission digest in signed permits. Responses never return the raw IP or database digest. No external proxy header fallback exists. Deployed spoof resistance still requires actual HTTP verification; documentation alone does not establish it.

Research and narration use different cryptographic domains and purposes. Narration retains its existing signed exact-script ticket and durable one-use nonce. No permissive in-memory admission fallback exists.

The v2 admission RPC independently rechecks the five-minute window under the database lock, using database time. Expired requests return EXPIRED without creating a nonce or consuming quotas. The legacy RPC accepts only existing signed narration requests; unsigned research from superseded previews is denied. No old research client can use the new RPC without backend-supplied permit timestamps. Database credentials remain server-only.
