# Fixed transfer public projection — UNAPPLIED LOCAL REVIEW

Base PR84: 40ba12f22f86ed8d11542ea03335290a1297aabb. No publication,
registration, dispatch, credential read, RPC or public-artifact approval occurred.
Existing reports from runs 39628746349, 39734447423, 39742090414 do not contain
complete raw transaction evidence. The collector therefore remains relevant.

## Collection and validation

Exactly one fixed finalized JSON getTransaction, max version 0, signature
37WZYkLnwzcPmYdoydTRhYAoUAcFGwHYem3QGt6exoSqt8H2SCZZuB5uUZg3Dd9NyTjYr62nhaxT2VbMELDKocA6,
slot 450097547, mint 98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump.
No discovery, retry, redirect, failover or following account calls. CLI defaults
closed. Uses only the existing ALCHEMY_SOLANA_ARCHIVE_RPC_URL reference; validates
HTTPS solana-mainnet.g.alchemy.com/v2/<key> with no alternate host/port/query.
Actual configured value/compatibility not inspected. 30-second total alarm;
2 MiB response bound plus one overflow-detection byte. Dispatch intent persists
before request. Linux-only signal/O_NOFOLLOW behavior; no Windows support claimed.

Exact response bytes initially go to a 0600 runner-local file in an exclusive
0700 directory. Parsing/projection occurs after capture/hash. Error, partial,
invalid or leakage-rejected bytes are removed locally; only bounded status/hash/
count remains in the local sanitized receipt. No automatic upload on failure.
Unexpected abrupt runner termination can prevent cleanup; no private file is on
any artifact upload path. Failed writes/interruptions never justify retry.

Success requires exact envelope ID/signature/slot/version, explicit null meta.err,
valid message header, canonical base58 signatures/keys/blockhash, bounded integer
account indexes (bool rejected), canonical bounded instruction bytes, ordered
outer/inner identities, loaded keys for v0, unique balance indexes, u64 decimal
amounts, decimals 0..255, and target Token-2022 transferChecked instruction plus
at least one target-mint balance entry. It is complete structural validation of
the selected evidence schema, NOT all RPC fields or semantic/signature validation.
Missing balances/ownership or inconsistent movement can still prevent subsequent
settlement acceptance. No current mint state is backdated into this transaction.

## Public artifact contract — still requires explicit owner approval

Only these two freshly generated, regular, non-symlink files are staged/uploadable:
- fixed-transfer-private/public/projection.json
- fixed-transfer-private/public/manifest.json
No wildcard, raw response, private receipt, request, endpoint, headers, environment,
log/error string or exception body is uploaded. Step success is required; always()
upload was removed. Staging failures remove staging files. O_EXCL/O_NOFOLLOW and
exclusive parent directory plus explicit pre-upload lstat checks reject symlinks.
These checks assume the trusted isolated runner; they do not defeat an actively
hostile concurrent privileged process replacing files after checks.

Projection fields: fixed schema, requested signature and validated signatures,
slot/version, commitmentRequested, target mint, executionError:null; message header,
ordered static account keys/recentBlockhash/compiled instructions; loaded writable/
readonly keys; ordered inner groups; pre/post balances with accountIndex/mint/raw
amount/decimals and canonical owner/programId only when present; target-transfer
positions; original-response SHA256 and byte count; explicit false signature,
transfer-behavior, settlement and score-verification flags.

Manifest fields: fixed schema, original-response SHA256/bytes, independently
computed projection SHA256/bytes, originalResponseIncluded:false. Projection is
not byte-identical raw evidence. Original hash cannot recover bytes or prove the
provider response without retaining/comparing those bytes. It is not an on-chain
signature verification claim. Excluded logs and other metadata cannot be audited
from this projection. Instruction, key and balance reconciliation survives; full
runtime/log/lamport/fee causality and historical mint-state proof do not.

Successful raw bytes remain only ephemeral runner-local data; no durable private
archive is claimed. Public artifact readers inherit repository access. Proposed
retention is one day, overwrite:false; downloaded copies cannot be revoked by
expiry. The artifact contains public blockchain evidence only after validation,
not a guarantee of universal secret detection. No use of private Supabase storage
or broad service credentials is authorized or introduced.

## Leakage defense and limits

Raw HTTP/JSON-RPC errors can echo endpoint credentials. They are never staged.
For successful responses, scan raw bytes, parsed JSON strings/keys and decoded
base58 binary fields for the exact endpoint/key/host and common base64, URL-safe
base64, hex and percent-encoded variants. JSON Unicode escapes are decoded by the
parser. Bounded additional decoding handles common nested forms. Apply the gate
again to the constructed projection; reject on ambiguity. No free-form third-party
logs, errors, URLs or extra fields are copied regardless of scanner results.

This is defense in depth, not universal detection: splitting secrets across fields,
arbitrary transforms, encryption, deep nesting and malicious covert channels are
not proven detectable. Canonical instruction bytes can be arbitrary program input;
the gate checks their decoded bytes but cannot prove semantic absence of every
possible secret encoding. Owner disclosure approval must understand this residual
limit. Sanitizing raw bytes changes their hash; never label a derivative as original.

## Execution gate, source pins and cost

Workflow now replaces the already registered .github/workflows/glitch-holder-h06-pump-operation.yml only in the local integration worktree; it is uncommitted/unpublished. Main is unchanged. Requires explicit approved_public_projection
input, exact repository/ref/reviewed SHA, dispatch event, attempt 1. No schedule or
permissions beyond contents:read; checkout persist-credentials:false. Pins reused
from independently retrieved accepted audit logs: checkout
11d5960a326750d5838078e36cf38b85af677262 and upload-artifact
ea165f8d65b6e75b540449e92b4886f43607fa02. No guessed pin or dependency installation.
Run-attempt and local directory guards do not prevent a new separate dispatch;
parent must authorize/control exactly one run. No execution approval implied here.

Nominal 40 CU at $0.525/million = $0.000021; actual billing/entitlement unverified.
Prior primary references: https://www.alchemy.com/docs/chains/solana/solana-api-endpoints/get-transaction
and https://www.alchemy.com/pricing. No new cost incurred by local tests.

Validation: node --test tests/fixed-transfer-collector.test.mjs, two tests passed,
including 21 synthetic Python check groups. New negatives: encoded key/endpoint
(JSON Unicode, URL-percent, base64, hex), malformed base58, bool/out-of-range indexes,
bool/overflow amounts, invalid decimals, symlink staging escape with outside file
preserved, excluded arbitrary logs/URLs, distinct original/projection hashes.
Reused checks cover disabled no-call behavior, exact request, durable intent,
truncated/error/failed/mismatched responses, bounds, deadlines, cancellation and
no retries. No real HTTP, no repeated app aggregate suite, no hosted acceptance.

## Registration and collateral effects review

The default-branch path already exists at pinned main a24e1411d0e3749b6e1029ff98855d72c1a68078
and previously executed as run 39742090414. This replacement reuses that registered
path; it does not assert registration of a new branch-only filename. Before any
separately approved dispatch, parent must verify current registration/enabled state,
exact published branch SHA/source and inputs. No protected main merge is proposed.
The old hardcoded assessment checkout and Helius operation are replaced only on
this candidate branch by the fixed Alchemy collector; main's legacy behavior remains.

Only workflow_dispatch triggers this collector. Public projection defaults false.
Attempt 1 rejects reruns of the same run, NOT a new independent dispatch. Parent
must control exactly one approved run; this is not durable cross-run fencing.

Current checked-in workflow_run listener is glitch-operational-email-alerts.yml,
limited to GLITCH evidence validation manual; it does not name this collector.
No wildcard workflow_run listener was found. The six checked-in PR workflow definitions use explicit Liquidity file path lists,
not a broad mvp/wallet-signal/** filter. This incremental collector patch does not
match those lists, but PR84 cumulative changes already include matched paths, so
PR synchronization may still run them. Existing Vercel Git integration may build previews. The patch does not change those triggers or any schedule.
Default-branch schedules are not dispatches of this branch-only replacement.
External webhooks/platform settings were not inspected and cannot be excluded by
source review. Registration/publication/execution remain separately review-gated.
