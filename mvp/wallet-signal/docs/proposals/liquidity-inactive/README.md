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
All pre-review output uses liquidity-quarantine-<run>, including successful valid
candidates. Partial output never stages; valid candidates stage only as quarantined,
always checkpointEligible false. Canonical publication/admission is not implemented.

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

## Installed binding and transport extension (local preparation)

`manifest-reader.sql` is a distinct UNAPPLIED extension; ac65c786 is unchanged.
It requires the reviewed closed schema/roles, exact existing authorize-function
body/search path/owner, RLS tables, retained administrator memberships and no direct
runtime table grants. It adds only operation-authorized read_manifest(uuid), owned
by the existing non-login code owner. Temporary setup SET/schema CREATE is removed
in the same transaction; new-function default grants are explicitly revoked and
postchecked. The modeled nonsuperuser cannot read pg_authid: no password-catalog
privilege was added. Existing NOLOGIN/connection-limit-zero guards remain enforced;
password absence is a separate retained setup audit, not asserted by this extension.
Read-only manifest access may return expired bindings for reconciliation; the
composition and SQL claim/reserve enforce expiry before work. No rows are enrolled.

The composition now checks every returned installed field before claim: operation,
repository/ref/SHA/run/attempt/purpose/pool, raw/semantic source digests, request
ceiling and start/expiry. Run IDs remain decimal strings. The old paragraph naming
the absent manifest reader is superseded by this proposed extension; actual hosted
installation and authenticated execution provenance remain unverified. A caller-
supplied execution object is NOT cryptographic GitHub identity.

`postgres.mjs` is default-disabled and outside active paths. It accepts only the
fixed direct GLITCH hostname, postgres database, port 5432 and exact executor or
reviewer role, plus explicitly supplied password and CA. No environment/URL/pgpass
fallback, role switching, arbitrary SQL, pooling or retry is exposed. Reviewer
transport initially only read manifest/receipts; the separate local artifact-review
preparation below now permits fixed record_review/admit calls for that role only.
It still cannot claim, reserve or stage. Executor
uses fixed typed parameterized claim/reserve/stage calls. Every connection verifies
TLS, database and session/current identity before its requested query. Connection
and server/client query deadlines are bounded; pg query AbortSignal is not assumed
supported. Cancellation destroys the stream and dispatched mutations stay unknown.
A real local test observed a claim commit after client cancellation and subsequent
lock release: client disconnect is not proof of rollback. Separate receipt readback
is mandatory before any future action; there is no automatic retry.

Official driver reference: https://node-postgres.com/features/ssl . Explicit SSL
options avoid connection-string SSL settings replacing the reviewed CA configuration.
No claim is made about hosted connectivity, CA availability or secret provisioning.
The public changelog markdown reader was unavailable; no hosted query was substituted.

`sidecars.mjs` defines the inactive workflow bundle contract. Trusted collection must
capture the exact main filename and any .pending/.lock files, record byte hashes,
and label EVERY pre-review bundle liquidity-quarantine-<run>, including a successful
single-main-file bundle. That name remains outside automatic history discovery.
Even a success-only main bundle requires independent lineage/publication review and
is never automatically checkpointEligible. Actual collector atomicity, artifact
upload, retention and separate reviewer admission still need reviewed integration.
Proposed workflow handling: capture worker conclusion; collect/quarantine with an
always-run step if the runner is alive; upload a distinct immutable bundle; reconcile
by artifact ID/full digest. Do not rename failed output into success, reuse an old
run ID, delete sidecars, auto-resume, or assume SIGKILL/storage loss can upload files.
No YAML/route/environment or retention setting is changed here.

Verification for this extension: `node --test tests/liquidity-inactive*.test.mjs`
passed 20 tests; network-blocked `npm run build` passed 1,694 tests plus build/lint/
types, persistence SKIPPED_NOT_OPTED_IN. `python3 tests/fixtures/liquidity-fencing/
run-manifest-local.py` passed 11 setup and 33 runtime checks in owned network-none
PostgreSQL 17. Exact proposed SQL ran under a nonsuperuser installer; direct table
reads/DML/role escalation stayed denied. Real pg/TLS/SCRAM verified manifest matching,
concurrent claims, redacted auth failure, blocked query timeout, cancellation and
separate readback. Initial fixture reload permission and cancellation-rollback
assumptions were corrected without broadening the proposal. Final cancelled-claim
readback found one committed row, no second claim. Fixture-local TLS setup used its
bootstrap administrator; this is not an operation available to the proposed roles.
Historical extension SQL SHA-256 (superseded by the correction below):
5d1b7eeaf81058502225a658608c03b3d9ee3029f4e8df4dc5fc054f9777da34.
No hosted SQL, credentials, RPC, workflow dispatch, push or deployment occurred.

## Quarantine discovery and privilege correction

Retained main fe5b845b8f0ecb618ff00770881ded26c0ee0e96 controlled-worker and
checkpoint-discovery-shadow definitions recognize canonical history/reconciled
names, then validate and select without a trusted admission receipt. Other retained
historical/replay/reconciliation paths download exact canonical names; recovery
investigator/replay paths likewise do not enforce the proposed SQL receipt.
The shared state selector validates lineage, not artifact admission. This is a
source audit, not proof of current deployed writers or quiescence.

The end-to-end regression uses the retained actual discovery validator/selector
CLI and workflow name filter. It first demonstrates that a newer valid canonical
candidate is selected without admission. With the corrected quarantine name,
legacy evidence remains selected; directly feeding that quarantine name to the
validator is also rejected. Successful and sidecar-bearing bundles are covered.
Fixtures and their provenance hashes are in tests/fixtures/liquidity-discovery.
No legacy evidence is renamed. Manual operator input is not authenticated by this
name filter. Canonical publication remains a separate, unimplemented admission step.
The pure descriptor no longer asserts sourcePreserved: hashes alone cannot prove
filesystem preservation, collector atomicity or immutable hosted publication.

The SQL extension now checks effective table AND column access before and after
installation, exact incoming/outgoing memberships, closed role attributes, schema
CREATE absence, and the reader's owner/security/search path. Unexpected default
function grants fail and roll back. Fault injection tests require the specific
expected rejection code, so unrelated SQL errors cannot count as a successful test.
The original ac65c786 proposal remains unchanged. Corrected reader SQL SHA-256:
fea52ca3bca09e2044f0af77ed67b27ea0b228d8cc29c3ab3dfafc7bbf1e7e3c.

Transport constructor/listener/connect failures are now inside the redaction and
cleanup boundary. Cleanup tolerates early missing streams and synchronous or
asynchronous close failures, releases the busy flag, and never retries a mutation.
The original constructor failure was reproduced with a synthetic throwing driver.

Latest verification: 23 focused tests; 67 disposable PostgreSQL checks (34 setup/
permission/rollback checks plus 33 real pg/TLS/runtime checks); network-blocked
npm run build passed all 1,697 tests, compilation, lint and type checks. Persistence
remained SKIPPED_NOT_OPTED_IN. No hosted operations, active entrypoint changes,
push or deployment. Liquidity remains 7/15 accepted; authentic evidence, approved
hosted setup, authenticated run provenance, writer quiescence and independent
artifact readback/admission remain open.

## Local artifact collection and independent review preparation

`collect.mjs` reads only the actual CLI main filename and its `.pending`/`.lock`
sidecars from a dedicated quiescent private directory. It rejects symlink directory
aliases, non-regular files, symlinks, hardlinks and unexpected entries. Fixed-size
positional reads, a second byte read, inode/size/ctime/mtime checks and a final
entry/inode check detect observed concurrent changes. It writes nothing. Stable
concurrent readers are permitted; a lock/partial/cancelled bundle stays quarantined.
These checks are not an OS snapshot or protection against a malicious process with
control over parent directories. The operator must stop writers and protect the
collection root. Non-cooperating filesystem changes after collection do not change
the copied bytes, but preservation of original files is not asserted by the API.

`review.mjs` reuses installed manifest/receipt reads and the retained lineage and
sidecar validators. The reviewer separately reads the artifact by staged immutable
ID, requires exactly one matching nonexpired successful quarantine artifact and
one main file, verifies raw and semantic parent identity, hashes the returned bytes,
and checks lineage before calling existing `record_review` and then `admit` SQL.
The executor transport cannot call either function. The reviewer cannot claim,
reserve or stage. No canonical artifact is published, and SQL admission is not
archive completeness, fee/withdrawal authority, calibrated scoring or release.

The injected artifact reader is a trusted, INACTIVE service boundary, not a caller
assertion or implemented GitHub authentication. Its normalized response is:
`{artifacts:[{artifactId,name,repository,ref,commit,run,attempt,expired,conclusion}],
files:[{name,bytes:Buffer}]}`. A future authenticated GitHub adapter must obtain run
metadata independently of executor output, reject duplicate/foreign artifacts and
limit archive/download/extracted size before allocation; no ZIP extraction or live
API client is introduced here. Exact run provenance remains unverified. Likewise,
`execution` is trusted input pending real workflow authentication, not evidence of
cryptographic identity. Database session separation is actually exercised locally.

Both new paths are disabled before dependency access. Collection and the whole
review operation have a conservative 20-second preparation deadline. `maxBytes`
must be explicit and cannot exceed 16 MiB; that local defensive ceiling is not an
approved live retention/download policy. No live request budget is expanded.
Current receipt JSON uses numeric bigint epochs: unsafe numbers are rejected,
not rounded. No SQL schema or either pending proposal hash changes in this slice.

Every dispatched review/admission write is uncertain until validated acknowledgment.
Cancellation after a possible or confirmed review also requires reconciliation;
there is no retry, refresh, overwrite, delete, canonical rename or automated resume.
An admission can commit despite a lost response; separate `read_receipt` resolves
that case. The existing reader does not expose the reviews row, so an uncertain
review write requires separately authorized operator inspection; it must not be
replayed automatically. This limitation does not authorize a new hosted read.

Verification uses real local FileHandles plus synthetic service responses and the
exact unapplied SQL in owned disposable PostgreSQL. It covers changed bytes during
read, concurrent stable readers, paths/links/limits, sidecars and cancellation,
foreign/duplicate artifact identities, digest/lineage failure, roles, replay,
concurrent reviewers, missing-review denial and committed-but-unacknowledged
admission. No actual artifacts, GitHub API, hosted SQL or real credentials are used.
Activation still requires approved setup/identities, authenticated service/run
binding, collection quiescence and an explicit bounded window. Canonical discovery
integration remains separate and disabled. Liquidity stays 7/15 accepted.

Final slice results: `node --test tests/liquidity-inactive*.test.mjs
 tests/liquidity-quarantine-discovery.test.mjs` passed 46 tests. The disposable
`python3 tests/fixtures/liquidity-fencing/run-manifest-local.py` passed 79 checks
(34 unchanged setup checks plus 45 runtime checks, including 12 new integration
checks). Network-blocked `npm run build` passed 1,720 application tests, build,
lint and types; persistence remained SKIPPED_NOT_OPTED_IN. No exact-head hosted
CI/Preview was run because publication remains prohibited.
