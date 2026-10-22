# Creator historical Global capture: operational acceptance

Scope: manual read-only capture at slot 442809233 on feature/creator-history-worker-500.
This document does not authorize scoring, ledger promotion, worker scheduling, main merge, or production deployment.

## Before dispatch (required)
- Confirm GitHub environment `creator-historical-capture` exists with required reviewers and deployment branch restrictions. Naming an environment in YAML does not configure its protections.
- Confirm `ALCHEMY_RPC_URL` is available to the job as a GitHub Actions secret without printing or exporting the credential outside the step.
- Confirm workflow dispatch is accessible. GitHub typically requires a workflow file on the default branch for manual dispatch; do not merge to main merely to expose the button. If unavailable, stop and request separate approval for an isolated safe registration mechanism.
- Review exact branch head and the complete workflow before approving its access to credentials.
- Confirm a private, access-controlled evidence store and retention policy if independently auditable bytes are required. The current workflow intentionally deletes its temporary capture and does not upload artifacts.

## Execution and acceptance
- Offline tests must pass before the credential-bearing step.
- One read-only `getAccountInfo` request targets Global account `4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf` at slot 442809233.
- Require JSON-RPC response ID/version, account owner, Global discriminator, context slot, 1045 bytes, canonical base64 and SHA-256 `9aa57beb2b897cc175a536f170ddb25c0c8bed8ed6620c7087d8a7fb834f7d30`.
- Candidate decoding is NOT historical schema applicability, fee-role authorization, settlement verification or ledger promotion.
- The current workflow logs a minimal success marker and deletes evidence on exit. This is a transient verification only, not durable evidence preservation.

## Stop conditions
Missing environment protection, missing secret, failed tests, unavailable manual dispatch, missing private retention approval, provider errors or mismatched evidence must not be bypassed by enabling production, relaxing verification, or committing secrets/raw payloads.

## Post-run evidence
Record the run URL, exact commit SHA, test results and sanitized diagnostic status. To support recipient reconciliation, a separately approved secure retention mechanism is required; no public GitHub artifact should contain raw account bytes or recipient report.
