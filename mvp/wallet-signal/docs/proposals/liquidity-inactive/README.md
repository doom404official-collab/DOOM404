# Inactive Liquidity quarantine composition — review candidate

`compose.mjs` is outside app/lib/workflow entry paths. It imports existing canonical
history, semantic-digest and deadline helpers. No environment loader, PostgreSQL
driver, credentials, HTTP provider, artifact uploader, route or workflow is added.
Default-disabled return precedes dependency reads. `enabled: true` is for injected
local tests only; it is NOT hosted activation authorization or authentication.

Contract: trusted installed binding and execution identity must match repository,
recovery ref, SHA, decimal run ID and attempt 1. Exact source bytes and the retained
semantic source projection are independently hashed. The reconciliation ancestor's
sourceDigest is preserved; it is not substituted for the current source digest.
The proposed executor session/current identity must match before claim. Claim epoch
stays a strict decimal string; each request gets an atomic reservation before the
callback. No retry, refresh, takeover, enrollment, direct DML or admission exists.
Canonical successor and request accounting checks precede immutable publication.
Partial output uses the existing isolated partial-name pattern and never stages;
valid candidates stage only as quarantined, always checkpointEligible false.

The session contract is a trusted parameterized `query({text,values,signal})` adapter
returning node-postgres-shaped rows, not caller-controlled HTTP data. Proposed SQL
function names/arguments match ac65c786. Publication must return the immutable
artifact ID, requested name and digest after uploading exactly the supplied bytes;
that assertion is mocked here, not proof of hosted storage integrity. Independent
readback/reviewer admission remains separate. A staged artifact is not acceptance.

Every wait uses the existing deadline helper: per-await maximum 20 seconds,
including this preparation's cycle callback, within the sealed <=8-minute window.
This intentionally conservative callback bound is NOT an approved live execution
budget. Existing CLI callbacks cannot be wired blindly: they still own incremental
local diagnostics, .lock/.pending quarantine and paid-progress preservation.
The composition does not capture a failed callback's inaccessible in-memory state.
Reservations and publication/staging dispatch are conservatively uncertain until
validated responses; a late write can finish after cancellation. Stop and reconcile
immutable operation/artifact receipts separately; never replay the mutation.

Unresolved activation dependencies: approval/application of the exact closed SQL;
real TLS executor session and project validation; authenticated immutable installed
manifest/run binding (read_receipt does not expose the manifest); actual immutable
artifact publishing/readback; independently scoped reviewer; legacy-writer
quiescence and explicit workflow sidecar/retention integration. No new grants or
identity infrastructure are proposed by this file. Nothing here resolves those
requirements or permits selecting arbitrary jobs or automatically admitting a
failed-run output. No active source imports this proposal.

Synthetic tests exercise real canonical validators/hashes with mocked SQL and
publication, including durable-mock claim replay across calls, concurrent calls,
reservation uncertainty, expiry, partial quarantine, late cancellation/errors and
lost stage acknowledgement. They do not prove actual distributed locking or TLS.
The retained isolated SQL checks remain separate evidence; SQL is unchanged and
was not rerun for this JavaScript-only preparation. Liquidity remains 7/15 accepted.
