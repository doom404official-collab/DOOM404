# CI-07 Signed upload authorization acceptance contract

Status: DESIGN ONLY. No live token minting, storage writes or workflow activation.
Scope: one Global account at slot 442809233 in private bucket creator-historical-evidence.

## Trust boundary
- A trusted server-side issuer holds any privileged Supabase credential. Never expose it to GitHub Actions logs, browser code, or public artifacts.
- Issuer validates caller authorization, exact commit and workflow identity, exact object path, short token expiry and single intended operation.
- Capture runner receives only an object-specific signed upload token. Signed tokens are bearer capabilities: do not log, commit or retain them.
- Readback is separately authorized. A signed upload token is not a download authorization.
- The uploader refuses upsert/overwrite. Verify duplicate-object rejection and investigate signed-token overwrite semantics before enabling.
- Require stored payload SHA-256 equality and historical account hash equality. Success is not scoring eligibility.
- Retention: define access audit, deletion rules, encryption/key-management assumptions and recovery before live capture.

## Offline acceptance matrix
1. Wrong bucket/path/slot/account/hash: reject before issuing.
2. Unauthorized caller/commit/workflow: reject.
3. Expired, reused or invalid token: reject.
4. Existing object: reject overwrite.
5. Upload succeeded but readback differs: reject.
6. Failed/timeout response: fail closed, no promotion.
7. Confirm no privileged key, signed token or raw account bytes in logs.

## External dependency
Supabase documents signed upload URL creation and upload via signed token, but expiry, replay and overwrite semantics must be confirmed against the chosen SDK/API and offline tests. No provider guarantees are assumed from this document.

## Release hold
Do not modify .github/workflows/creator-global-restricted-capture.yml to enable the credential-backed step until CI-05 through CI-08 are independently accepted.
